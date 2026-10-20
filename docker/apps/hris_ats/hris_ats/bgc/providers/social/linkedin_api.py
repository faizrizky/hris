# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""LinkedIn Voyager API client used with a signed-in crawler account session (li_at + JSESSIONID).

The public /in/ page shows a profile card only; posts and comments come from the Voyager JSON API
that linkedin.com itself calls. JSESSIONID doubles as the CSRF token. Posts are the member's share
feed (own posts and reposts); post timestamps are decoded from the activity id. Candidate comments
are the member's comments and replies under their own posts; LinkedIn's "Comments" activity tab uses
a rotating GraphQL query and is not read.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Iterator
from typing import Any
from urllib.parse import quote, urlencode

from hris_ats.bgc.providers.social.api_base import (
	ApiUnavailable,
	PacedApiClient,
	ProfileNotFound,
	RateLimited,
	SessionRejected,
	as_int,
	crawl_comments,
	parse_json,
	snippet,
	ts_to_str,
	walk,
	within_window,
)

BASE = "https://www.linkedin.com"
API = BASE + "/voyager/api"
TOP_CARD_DECORATION = "com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-19"
ACTIVITY_RE = re.compile(r"urn:li:activity:(\d+)")
PAGE_SIZE = 20


class LinkedInSessionError(SessionRejected):
	pass


class LinkedInRateLimited(RateLimited):
	pass


class LinkedInNotFound(ProfileNotFound):
	pass


class LinkedInApiClient(PacedApiClient):
	platform = "LinkedIn"

	def _get(self, path: str, params: dict[str, Any] | None, referer: str) -> dict[str, Any]:
		csrf = (self.cookies.get("JSESSIONID") or "").strip('"')
		if not csrf:
			raise LinkedInSessionError("JSESSIONID cookie missing; reconnect the crawler account")
		headers = {
			"csrf-token": csrf,
			"x-restli-protocol-version": "2.0.0",
			"x-li-lang": "en_US",
			"accept": "application/json",
			"referer": referer,
		}
		url = API + path + (("?" + urlencode(params, safe=":(),")) if params else "")
		status, body = self._raw_get(url, headers)
		data = parse_json(body)
		if status in (429, 999):
			raise LinkedInRateLimited(f"HTTP {status}")
		if status == 401 or "csrf check failed" in (body or "")[:500].lower():
			raise LinkedInSessionError(f"HTTP {status}")
		if status == 403:
			raise LinkedInSessionError("HTTP 403 (session restricted)")
		if status in (404, 410):
			raise LinkedInNotFound(path)
		if status == 200 and not isinstance(data, dict):
			# An HTML login/authwall page instead of JSON means the cookie is no longer valid
			if "authwall" in (body or "") or "login" in (body or "")[:5000].lower():
				raise LinkedInSessionError("redirected to login")
			raise ApiUnavailable(f"LinkedIn returned non-JSON for {path}")
		if status != 200 or not isinstance(data, dict):
			raise LinkedInRateLimited(f"HTTP {status}")
		inner = as_int(data.get("status"))
		if inner and inner >= 400:
			if inner == 401:
				raise LinkedInSessionError(str(data.get("message") or inner))
			if inner in (404, 410):
				raise LinkedInNotFound(path)
			if inner == 429:
				raise LinkedInRateLimited(str(data.get("message") or inner))
			raise ApiUnavailable(str(data.get("message") or f"status {inner}"))
		return data

	def profile(self, username: str) -> dict[str, Any]:
		referer = f"{BASE}/in/{quote(username)}/"
		try:
			data = self._get(
				"/identity/dash/profiles",
				{"q": "memberIdentity", "memberIdentity": username, "decorationId": TOP_CARD_DECORATION},
				referer,
			)
		except (LinkedInNotFound, ApiUnavailable):
			data = self._get(f"/identity/profiles/{quote(username)}/profileView", None, referer)
		target = username.lower()
		prof = None
		for d in walk(data):
			urn = str(d.get("entityUrn") or "")
			if ("fsd_profile:" in urn or "fs_profile:" in urn) and str(d.get("publicIdentifier") or "").lower() == target:
				prof = d
				break
		if prof is None:
			raise LinkedInNotFound(username)
		location = (
			((prof.get("geoLocation") or {}).get("geo") or {}).get("defaultLocalizedName")
			or prof.get("geoLocationName")
			or prof.get("locationName")
			or ""
		)
		result = {
			"id": str(prof["entityUrn"]).rsplit(":", 1)[-1],
			"display_name": " ".join(x for x in (prof.get("firstName"), prof.get("lastName")) if x).strip(),
			"bio": prof.get("headline") or "",
			"location": location,
			"followers_count": None,
			"following_count": None,
		}
		try:
			net = self._get(f"/identity/profiles/{quote(username)}/networkinfo", None, referer)
			result["followers_count"] = as_int(net.get("followersCount") or (net.get("data") or {}).get("followersCount"))
		except (LinkedInNotFound, ApiUnavailable):
			pass
		return result

	def iter_posts(
		self, profile_id: str, username: str, max_posts: int, earliest_ts: float | None
	) -> Iterator[dict[str, Any]]:
		"""Yield the member's shares newest first until max_posts or the lookback window is reached."""
		start = 0
		token = ""
		yielded = 0
		referer = f"{BASE}/in/{quote(username)}/recent-activity/all/"
		for page_no in range(100):
			params = {
				"q": "memberShareFeed",
				"moduleKey": "member-shares:phone",
				"includeLongTermHistory": "true",
				"profileUrn": f"urn:li:fsd_profile:{profile_id}",
				"count": PAGE_SIZE,
				"start": start,
			}
			if token:
				params["paginationToken"] = token
			data = self._get("/identity/profileUpdatesV2", params, referer)
			elements = data.get("elements") or []
			for idx, el in enumerate(elements):
				post = self.normalize_update(el)
				if post is None:
					continue
				if not within_window(post["_ts"], earliest_ts):
					# The feed is newest first, except that it can open with an older pinned post
					if page_no == 0 and idx == 0:
						continue
					return
				post.pop("_ts", None)
				yield post
				yielded += 1
				if yielded >= max_posts:
					return
			token = ((data.get("metadata") or {}).get("paginationToken")) or ""
			if not elements or not token:
				return
			start += len(elements)

	def normalize_update(self, el: dict[str, Any]) -> dict[str, Any] | None:
		urn = str((el.get("updateMetadata") or {}).get("urn") or el.get("entityUrn") or el.get("urn") or "")
		m = ACTIVITY_RE.search(urn)
		if not m:
			return None
		activity_id = m.group(1)
		ts = (int(activity_id) >> 22) / 1000
		text, ranges = _text_and_mentions(el.get("commentary"))
		if not text and isinstance(el.get("resharedUpdate"), dict):
			inner, inner_ranges = _text_and_mentions(el["resharedUpdate"].get("commentary"))
			if inner:
				text, ranges = "Repost: " + inner, [(s + 8, n) for s, n in inner_ranges]
		content = json.dumps(el.get("content") or {})
		media = "Video" if "VideoComponent" in content else "Photo" if "ImageComponent" in content else "Text"
		counts = (el.get("socialDetail") or {}).get("totalSocialActivityCounts") or {}
		return {
			"pk": activity_id,
			"snippet": snippet(text, ranges),
			"published_on": ts_to_str(ts),
			"url": f"{BASE}/feed/update/urn:li:activity:{activity_id}/",
			"media_type": media,
			"comment_count": as_int(counts.get("numComments")) or 0,
			"_ts": ts,
		}

	def iter_candidate_comments(
		self, post: dict[str, Any], candidate_username: str, limit: int, profile_id: str = ""
	) -> Iterator[dict[str, Any]]:
		"""Yield comments and replies written by the member under one of their posts."""
		if not post.get("comment_count") or limit <= 0:
			return
		profile_id = profile_id or getattr(self, "profile_id", "")
		target = candidate_username.lower()
		found = 0
		start = 0
		for _page in range(10):
			data = self._get(
				"/feed/comments",
				{"count": 100, "start": start, "q": "comments", "sortOrder": "RELEVANCE", "updateId": f"activity:{post['pk']}"},
				post["url"],
			)
			elements = data.get("elements") or []
			for top in elements:
				for c, is_reply in _comment_tree(top):
					if not _is_author(c, target, profile_id):
						continue
					text, ranges = _text_and_mentions(c.get("commentV2") or c.get("comment"))
					found += 1
					yield {
						"snippet": snippet(text, ranges),
						"published_on": ts_to_str((as_int(c.get("createdTime")) or 0) / 1000),
						"url": c.get("permalink") or post["url"],
						"media_type": "Text",
						"is_reply": is_reply,
					}
					if found >= limit:
						return
			total = as_int((data.get("paging") or {}).get("total")) or 0
			start += len(elements)
			if not elements or start >= total:
				return

	def crawl_profile(
		self,
		username: str,
		max_posts: int,
		max_comments: int,
		earliest_ts: float | None,
		result: dict[str, Any],
		report: Callable[..., None],
	) -> None:
		report("{0} @{1}: reading profile", "LinkedIn", username)
		prof = self.profile(username)
		self.profile_id = prof["id"]
		result.update(
			display_name=prof["display_name"],
			bio=prof["bio"],
			location=prof["location"],
			is_private=False,
			followers_count=prof["followers_count"],
			following_count=prof["following_count"],
		)
		result["_profile_loaded"] = True
		for post in self.iter_posts(prof["id"], username, max_posts, earliest_ts):
			result["posts"].append(post)
			if len(result["posts"]) % PAGE_SIZE == 0:
				report("{0} @{1}: {2} posts read", "LinkedIn", username, len(result["posts"]))
		result["posts_count"] = len(result["posts"])
		crawl_comments(self, "LinkedIn", username, result, max_comments, report)
		result["comment_limitation"] = (
			"Comments: only the candidate's comments under their own posts; comments on others' posts are not read."
		)


def _text_and_mentions(node: Any) -> tuple[str, list[tuple[int, int]]]:
	"""Text plus spans of profile/company mentions from a commentary/commentV2 node."""
	if not isinstance(node, dict):
		return "", []
	text_node = node.get("text") if isinstance(node.get("text"), dict) else node
	text = text_node.get("text") or ""
	if not isinstance(text, str):
		return "", []
	ranges = []
	for a in (text_node.get("attributes") or []) + (text_node.get("attributesV2") or []):
		if not isinstance(a, dict):
			continue
		kind = json.dumps({k: v for k, v in a.items() if k not in ("start", "length")}).lower()
		if "hashtag" in kind:
			continue
		if any(k in kind for k in ("profile", "company", "mention", "member")):
			ranges.append((as_int(a.get("start")) or 0, as_int(a.get("length")) or 0))
	return text, ranges


def _comment_tree(top: dict[str, Any]) -> Iterator[tuple[dict[str, Any], bool]]:
	yield top, False
	for d in walk(top.get("socialDetail") or {}):
		if ("commentV2" in d or "comment" in d) and "commenter" in d:
			yield d, True


def _is_author(c: dict[str, Any], target: str, profile_id: str) -> bool:
	for d in walk(c.get("commenter") or {}):
		if str(d.get("publicIdentifier") or "").lower() == target:
			return True
		urn = str(d.get("entityUrn") or d.get("urn") or "")
		if profile_id and urn.endswith(":" + profile_id):
			return True
	return False
