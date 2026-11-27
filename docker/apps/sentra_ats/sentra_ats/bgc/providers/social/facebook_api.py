# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Facebook web client used with a signed-in crawler account session (c_user + xs cookies).

Signed in, the profile page embeds Relay preload JSON with the first timeline stories (each with
its preview comments), the page's fb_dtsg/lsd tokens and the timeline cursor. Further pages come
from POST /api/graphql/ with the ProfileCometTimelineFeedRefetchQuery persisted query, whose doc_id
rotates with Facebook releases: it is taken from configuration or discovered in the page's static
JS bundles. Without it only the preloaded stories are returned and a limitation is reported.

Only stories whose actor is the profile owner are kept (wall posts by friends are skipped). Candidate
comments are the owner's comments/replies among the preview comments loaded with each story; Facebook
offers no per-user list of comments written elsewhere.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Iterator
from typing import Any
from urllib.parse import quote

from sentra_ats.bgc.providers.social.api_base import (
	ApiUnavailable,
	PacedApiClient,
	ProfileNotFound,
	RateLimited,
	SessionRejected,
	as_int,
	find_key,
	parse_json,
	snippet,
	ts_to_str,
	walk,
	within_window,
)

BASE = "https://www.facebook.com"
REFETCH_QUERY = "ProfileCometTimelineFeedRefetchQuery"
JSON_SCRIPT_RE = re.compile(r'<script type="application/json"[^>]*>(.*?)</script>', re.S)
DTSG_RE = re.compile(r'"DTSGInitialData",\[\],\{"token":"([^"]+)"')
LSD_RE = re.compile(r'"LSD",\[\],\{"token":"([^"]+)"')
PROFILE_ID_RES = (
	re.compile(r'"props":\{"userID":"(\d+)"'),
	re.compile(r'"userID":"(\d+)","userVanity"'),
	re.compile(r'"profile_owner":\{"id":"(\d+)"'),
	re.compile(r'"pageID":"(\d+)"'),
)
OWNER_NAME_RE = re.compile(r'"profile_owner":\{"id":"\d+","name":"((?:[^"\\]|\\.)*)"')
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.S)
BUNDLE_RE = re.compile(r'(https:(?:\\/\\/|//)static\.xx\.fbcdn\.net(?:\\/|/)rsrc\.php(?:\\/|/)[^"\s]+?\.js(?:\?[^"\s]*)?)"')
DOC_ID_RE = re.compile(
	REFETCH_QUERY + r'_facebookRelayOperation",\[\],\(function\([^)]*\)\{[a-z]\.exports="(\d+)"'
)
SESSION_ERROR_CODES = {1357001, 1357004, 1348007}
RATE_ERROR_CODES = {1675004, 1675002, 368, 3252001}
NOT_FOUND_MARKERS = ("this content isn't available", "this page isn't available", "konten ini tidak tersedia")


class FacebookSessionError(SessionRejected):
	pass


class FacebookRateLimited(RateLimited):
	pass


class FacebookNotFound(ProfileNotFound):
	pass


class FacebookApiClient(PacedApiClient):
	platform = "Facebook"

	def __init__(self, cookies: dict[str, str], doc_id: str | None = None, max_bundles: int = 25, **kw: Any):
		super().__init__(cookies, **kw)
		self.doc_id = doc_id
		self.max_bundles = max_bundles
		self.viewer_id = cookies.get("c_user", "")

	@staticmethod
	def profile_url(username: str) -> str:
		if username.isdigit():
			return f"{BASE}/profile.php?id={username}"
		return f"{BASE}/{quote(username)}"

	def load_profile_page(self, username: str) -> dict[str, Any]:
		"""Fetch the signed-in profile page; return tokens, profile id and the preloaded timeline."""
		url = self.profile_url(username)
		status, body = self._raw_get(url, {"accept": "text/html,application/xhtml+xml", "sec-fetch-mode": "navigate"})
		lower = (body or "")[:400_000].lower()
		if status == 429:
			raise FacebookRateLimited(f"HTTP {status}")
		if status == 404:
			raise FacebookNotFound(username)
		if status in (401, 403) or 'id="login_form"' in lower or '"user_id":"0"' in lower:
			raise FacebookSessionError("not signed in")
		if status != 200:
			raise FacebookRateLimited(f"HTTP {status}")

		profile_id = username if username.isdigit() else ""
		for rx in PROFILE_ID_RES:
			if profile_id:
				break
			m = rx.search(body)
			profile_id = m.group(1) if m else ""
		if not profile_id:
			if "/checkpoint/" in lower:
				raise FacebookSessionError("checkpoint required")
			if any(k in lower for k in NOT_FOUND_MARKERS):
				raise FacebookNotFound(username)
			raise ApiUnavailable("Facebook profile id not found in page")

		blobs = [b for b in (parse_json(m.group(1)) for m in JSON_SCRIPT_RE.finditer(body)) if b is not None]
		name_m = OWNER_NAME_RE.search(body)
		name = _unescape(name_m.group(1)) if name_m else ""
		if not name:
			t = TITLE_RE.search(body)
			name = re.sub(r"\s*\|\s*Facebook\s*$", "", t.group(1)).strip() if t else ""
		bio = ""
		for d in walk(blobs):
			b = d.get("bio") if isinstance(d.get("bio"), dict) else None
			if b and b.get("text"):
				bio = b["text"]
				break
		dtsg, lsd = DTSG_RE.search(body), LSD_RE.search(body)
		return {
			"id": profile_id,
			"url": url,
			"display_name": name,
			"bio": bio,
			"fb_dtsg": dtsg.group(1) if dtsg else "",
			"lsd": lsd.group(1) if lsd else "",
			"blobs": blobs,
			"html": body,
		}

	# --- timeline -------------------------------------------------------------------------------

	def discover_doc_id(self, html: str) -> str | None:
		"""Find the timeline refetch doc_id in the static JS bundles the profile page loads."""
		if m := DOC_ID_RE.search(html or ""):
			return m.group(1)
		seen: list[str] = []
		for m in BUNDLE_RE.finditer(html or ""):
			u = m.group(1).replace("\\/", "/")
			if u not in seen:
				seen.append(u)
		for u in seen[: self.max_bundles]:
			try:
				status, js = self.http_get(u, {"accept": "*/*"}, {}, self.timeout)
			except Exception:
				continue
			if status == 200 and REFETCH_QUERY in (js or ""):
				if m := DOC_ID_RE.search(js):
					return m.group(1)
		return None

	def fetch_timeline_page(self, page: dict[str, Any], cursor: str) -> list[Any]:
		variables = {
			"afterTime": None,
			"beforeTime": None,
			"count": 3,
			"cursor": cursor,
			"feedLocation": "TIMELINE",
			"feedbackSource": 0,
			"focusCommentID": None,
			"memorializedSplitTimeFilter": None,
			"omitPinnedPost": True,
			"postedBy": None,
			"privacy": None,
			"privacySelectorRenderLocation": "COMET_STREAM",
			"renderLocation": "timeline",
			"scale": 1,
			"stream_count": 1,
			"taggedInOnly": None,
			"useDefaultActor": False,
			"id": page["id"],
		}
		data = {
			"av": self.viewer_id,
			"__user": self.viewer_id,
			"__a": "1",
			"__comet_req": "15",
			"fb_dtsg": page["fb_dtsg"],
			"lsd": page["lsd"],
			"fb_api_caller_class": "RelayModern",
			"fb_api_req_friendly_name": REFETCH_QUERY,
			"variables": json.dumps(variables, separators=(",", ":")),
			"server_timestamps": "true",
			"doc_id": self.doc_id or "",
		}
		headers = {
			"x-fb-friendly-name": REFETCH_QUERY,
			"x-fb-lsd": page["lsd"],
			"content-type": "application/x-www-form-urlencoded",
			"origin": BASE,
			"referer": page["url"],
			"accept": "*/*",
		}
		status, body = self._raw_post(f"{BASE}/api/graphql/", data, headers)
		if status == 429:
			raise FacebookRateLimited(f"HTTP {status}")
		if status in (401, 403):
			raise FacebookSessionError(f"HTTP {status}")
		lines = [x for x in (parse_json(line) for line in (body or "").splitlines()) if x is not None]
		if not lines:
			if "login_form" in (body or "") or "/login/" in (body or "")[:2000]:
				raise FacebookSessionError("not signed in")
			raise ApiUnavailable(f"Facebook timeline query returned no data (HTTP {status})")
		for obj in lines:
			if not isinstance(obj, dict):
				continue
			code = as_int(obj.get("error"))
			errors = obj.get("errors") or []
			codes = {code} | {as_int(e.get("code")) for e in errors if isinstance(e, dict)}
			msgs = " ".join(str(e.get("message") or "") for e in errors if isinstance(e, dict))
			msgs += " " + str(obj.get("errorSummary") or "")
			if codes & SESSION_ERROR_CODES or "not logged in" in msgs.lower():
				raise FacebookSessionError(msgs.strip() or f"error {code}")
			if codes & RATE_ERROR_CODES or "rate limit" in msgs.lower():
				raise FacebookRateLimited(msgs.strip() or f"error {code}")
			if errors and not obj.get("data"):
				raise ApiUnavailable(msgs.strip() or "Facebook timeline query rejected")
		return lines

	@staticmethod
	def stories_and_cursor(blobs: list[Any]) -> tuple[list[dict[str, Any]], str | None, bool]:
		"""Timeline stories and the timeline cursor (not the comment cursors nested in stories)."""
		stories: list[dict[str, Any]] = []
		cursor, has_next = None, False

		def take_info(info: Any) -> None:
			nonlocal cursor, has_next
			if isinstance(info, dict) and "end_cursor" in info:
				cursor, has_next = info.get("end_cursor"), bool(info.get("has_next_page"))

		for d in walk(blobs):
			feed = d.get("timeline_list_feed_units")
			if isinstance(feed, dict):
				stories.extend(
					e["node"] for e in feed.get("edges") or [] if isinstance((e or {}).get("node"), dict)
				)
				take_info(feed.get("page_info"))
			label = d.get("label")
			if isinstance(label, str) and "timeline_list_feed_units" in label and isinstance(d.get("data"), dict):
				node = d["data"].get("node")
				if isinstance(node, dict) and node.get("__typename") == "Story":
					stories.append(node)
				take_info(d["data"].get("page_info"))
		if not stories:
			stories = [
				d["node"] for d in walk(blobs) if isinstance(d.get("node"), dict) and d["node"].get("__typename") == "Story"
			]
		return stories, cursor, has_next

	def iter_posts(
		self, page: dict[str, Any], max_posts: int, earliest_ts: float | None, limitations: list[str]
	) -> Iterator[dict[str, Any]]:
		"""Yield the owner's stories newest first: preloaded ones, then GraphQL pages."""
		seen: set[str] = set()
		yielded = 0
		blobs = page["blobs"]
		pages = 0
		while True:
			stories, cursor, has_next = self.stories_and_cursor(blobs)
			for st in stories:
				post = self.normalize_story(st, page)
				if post is None or post["pk"] in seen:
					continue
				seen.add(post["pk"])
				if not within_window(post["_ts"], earliest_ts):
					if post["_pinned"]:
						continue
					return
				yield post
				yielded += 1
				if yielded >= max_posts:
					return
			if not has_next or not cursor or pages >= 150:
				return
			if not self.doc_id:
				self.doc_id = self.discover_doc_id(page.get("html", ""))
			if not self.doc_id or not page.get("fb_dtsg"):
				limitations.append(
					"Only the posts embedded in the profile page were read (timeline query id unavailable)."
				)
				return
			pages += 1
			blobs = self.fetch_timeline_page(page, cursor)

	def normalize_story(self, st: dict[str, Any], page: dict[str, Any]) -> dict[str, Any] | None:
		owner = page["id"]
		actors = st.get("actors") or find_key(st, "actors") or []
		actor_ids = {str(a.get("id")) for a in actors if isinstance(a, dict) and a.get("id")}
		if actor_ids and owner not in actor_ids:
			return None  # posted on the candidate's wall by someone else
		msg = st.get("message") if isinstance(st.get("message"), dict) else None
		if msg is None:
			for d in walk(st.get("comet_sections") or st):
				if isinstance(d.get("message"), dict) and "text" in d["message"]:
					msg = d["message"]
					break
		msg = msg or {}
		ranges = [
			(r.get("offset", 0), r.get("length", 0))
			for r in msg.get("ranges") or []
			if isinstance(r, dict)
			and (r.get("entity") or {}).get("__typename") in ("User", "Page")
			and str((r.get("entity") or {}).get("id")) != owner
		]
		ts = as_int(st.get("creation_time") or find_key(st, "creation_time")) or 0
		pk = str(st.get("post_id") or find_key(st, "post_id") or st.get("id") or "")
		if not pk:
			return None
		media = "Text"
		for d in walk(st.get("attachments") or []):
			t = d.get("__typename")
			if t == "Video":
				media = "Video"
				break
			if t == "Photo":
				media = "Photo"
		return {
			"pk": pk,
			"snippet": snippet(msg.get("text") or "", ranges),
			"published_on": ts_to_str(ts),
			"url": _story_url(st) or page["url"],
			"media_type": media,
			"_ts": ts,
			"_pinned": bool(find_key(st, "is_pinned") or find_key(st, "pinned")),
			"_story": st,
		}

	def candidate_comments(self, post: dict[str, Any], owner_id: str, limit: int) -> list[dict[str, Any]]:
		out: list[dict[str, Any]] = []
		seen: set[str] = set()
		for d in walk(post.get("_story") or {}):
			if d.get("__typename") != "Comment" or not isinstance(d.get("body"), dict):
				continue
			cid = str(d.get("id") or d.get("legacy_fbid") or "")
			if cid in seen or str((d.get("author") or {}).get("id")) != owner_id:
				continue
			seen.add(cid)
			ranges = [
				(r.get("offset", 0), r.get("length", 0))
				for r in d["body"].get("ranges") or []
				if isinstance(r, dict) and str((r.get("entity") or {}).get("id")) != owner_id
			]
			out.append({
				"snippet": snippet(d["body"].get("text") or "", ranges),
				"published_on": ts_to_str(d.get("created_time")),
				"url": d.get("url") or post["url"],
				"media_type": "Text",
				"is_reply": bool((as_int(d.get("depth")) or 0) > 0 or d.get("comment_parent")),
			})
			if len(out) >= limit:
				break
		return out

	def crawl_profile(
		self,
		username: str,
		max_posts: int,
		max_comments: int,
		earliest_ts: float | None,
		result: dict[str, Any],
		report: Callable[..., None],
	) -> None:
		report("{0} @{1}: reading profile", "Facebook", username)
		page = self.load_profile_page(username)
		result.update(display_name=page["display_name"], bio=page["bio"], location="", is_private=False)
		result["_profile_loaded"] = True
		limitations: list[str] = []
		remaining = max_comments
		try:
			for post in self.iter_posts(page, max_posts, earliest_ts, limitations):
				if remaining > 0:
					got = self.candidate_comments(post, page["id"], remaining)
					result["comments"].extend(got)
					remaining -= len(got)
				for k in ("_ts", "_pinned", "_story"):
					post.pop(k, None)
				result["posts"].append(post)
				if len(result["posts"]) % 15 == 0:
					report("{0} @{1}: {2} posts read", "Facebook", username, len(result["posts"]))
		finally:
			limitations.append(
				"Comments: only the candidate's comments among the preview comments loaded with their own posts."
			)
			result["comment_limitation"] = " ".join(limitations)
		if not result["posts"]:
			result["comment_limitation"] = (
				"No posts visible to the crawler account (friends-only or empty timeline). "
				+ result["comment_limitation"]
			)


def _story_url(st: dict[str, Any]) -> str:
	for d in walk(st):
		u = d.get("url") or d.get("wwwURL")
		if isinstance(u, str) and "facebook.com" in u and any(
			k in u for k in ("/posts/", "story_fbid", "/videos/", "/photos/", "/permalink", "/reel/")
		):
			return u
	return ""


def _unescape(s: str) -> str:
	try:
		return json.loads(f'"{s}"')
	except ValueError:
		return s
