# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""TikTok web API client used with a signed-in crawler account session.

The profile page only carries the user card; videos and comments come from the JSON endpoints the
TikTok web app calls (/api/user/detail, /api/post/item_list, /api/comment/list[/reply]). TikTok
may refuse unsigned item_list calls with an empty 200 body; that is reported as ApiUnavailable so
the profile data already read is kept. Candidate comments are those the candidate wrote under their
own videos (top-level or replies); TikTok exposes no per-user list of comments made elsewhere.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterator
from typing import Any
from urllib.parse import urlencode

from sentra_ats.bgc.providers.social.api_base import (
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
	within_window,
)

BASE = "https://www.tiktok.com"
WEB_PARAMS = {
	"aid": "1988",
	"app_language": "en",
	"app_name": "tiktok_web",
	"browser_language": "en-US",
	"browser_name": "Mozilla",
	"browser_platform": "Win32",
	"channel": "tiktok_web",
	"cookie_enabled": "true",
	"device_platform": "web_pc",
	"os": "windows",
	"region": "ID",
	"tz_name": "Asia/Jakarta",
}
NOT_FOUND_CODES = {10202, 10221, 10223}
PRIVATE_CODES = {10222}
LOGIN_CODES = {8, 2053}
REHYDRATION_RE = re.compile(r'<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', re.S)


class TikTokSessionError(SessionRejected):
	pass


class TikTokRateLimited(RateLimited):
	pass


class TikTokNotFound(ProfileNotFound):
	pass


class TikTokApiClient(PacedApiClient):
	platform = "TikTok"

	def _get(self, path: str, params: dict[str, Any], referer: str) -> dict[str, Any]:
		q = {**WEB_PARAMS, **{k: str(v) for k, v in params.items()}}
		if self.cookies.get("msToken"):
			q["msToken"] = self.cookies["msToken"]
		headers = {"referer": referer, "accept": "application/json, text/plain, */*"}
		status, body = self._raw_get(f"{BASE}{path}?{urlencode(q)}", headers)
		if status == 429:
			raise TikTokRateLimited(f"HTTP {status}")
		if status in (401, 403):
			raise TikTokSessionError(f"HTTP {status}")
		if status == 404:
			raise TikTokNotFound(path)
		data = parse_json(body)
		if status == 200 and not body.strip():
			# TikTok answers unsigned/unauthorized web API calls with an empty 200
			raise ApiUnavailable(f"TikTok returned an empty response for {path}")
		if status != 200 or not isinstance(data, dict):
			raise TikTokRateLimited(f"HTTP {status}")
		code = data.get("statusCode", data.get("status_code", 0)) or 0
		msg = str(data.get("statusMsg") or data.get("status_msg") or "")
		if code in LOGIN_CODES or "login" in msg.lower():
			raise TikTokSessionError(msg or f"status {code}")
		if code == 10000 or "captcha" in msg.lower() or "verify" in msg.lower():
			raise TikTokSessionError(msg or "captcha required")
		if code in NOT_FOUND_CODES:
			raise TikTokNotFound(msg or f"status {code}")
		if code and code not in PRIVATE_CODES:
			raise TikTokRateLimited(msg or f"status {code}")
		return data

	def profile(self, username: str) -> dict[str, Any]:
		referer = f"{BASE}/@{username}"
		try:
			data = self._get("/api/user/detail/", {"uniqueId": username, "secUid": ""}, referer)
			info = data.get("userInfo") or {}
		except ApiUnavailable:
			info = self._profile_from_page(username)
		user, stats = info.get("user") or {}, info.get("stats") or info.get("statsV2") or {}
		if not user.get("secUid"):
			raise TikTokNotFound(username)
		return {
			"id": user.get("id"),
			"sec_uid": user["secUid"],
			"username": user.get("uniqueId") or username,
			"display_name": user.get("nickname") or "",
			"bio": user.get("signature") or "",
			"is_private": bool(user.get("privateAccount") or user.get("secret")),
			"followers_count": as_int(stats.get("followerCount")),
			"following_count": as_int(stats.get("followingCount")),
			"posts_count": as_int(stats.get("videoCount")),
		}

	def _profile_from_page(self, username: str) -> dict[str, Any]:
		"""Fallback: the user card is embedded in the profile page's rehydration JSON."""
		status, body = self._raw_get(f"{BASE}/@{username}", {"accept": "text/html"})
		if status == 429:
			raise TikTokRateLimited(f"HTTP {status}")
		m = REHYDRATION_RE.search(body or "")
		data = parse_json(m.group(1)) if m else None
		detail = ((data or {}).get("__DEFAULT_SCOPE__") or {}).get("webapp.user-detail") or {}
		code = detail.get("statusCode") or 0
		if code in NOT_FOUND_CODES or status == 404:
			raise TikTokNotFound(username)
		if not detail.get("userInfo"):
			raise ApiUnavailable("TikTok profile data unavailable")
		return detail["userInfo"]

	def iter_posts(
		self, sec_uid: str, username: str, max_posts: int, earliest_ts: float | None
	) -> Iterator[dict[str, Any]]:
		"""Yield normalized videos newest first until max_posts or the lookback window is reached."""
		cursor = "0"
		yielded = 0
		pages = 0
		while yielded < max_posts and pages < 100:
			pages += 1
			data = self._get(
				"/api/post/item_list/",
				{"secUid": sec_uid, "count": 30, "cursor": cursor, "coverFormat": 2},
				f"{BASE}/@{username}",
			)
			for it in data.get("itemList") or []:
				taken = as_int(it.get("createTime")) or 0
				if not within_window(taken, earliest_ts):
					if it.get("isPinnedItem"):
						continue  # pinned videos can predate the window and come first
					return
				vid = str(it.get("id") or "")
				yield {
					"pk": vid,
					"snippet": snippet(it.get("desc") or ""),
					"published_on": ts_to_str(taken),
					"url": f"{BASE}/@{username}/video/{vid}" if vid else f"{BASE}/@{username}",
					"media_type": "Photo" if it.get("imagePost") else "Video",
					"comment_count": as_int((it.get("stats") or {}).get("commentCount")) or 0,
				}
				yielded += 1
				if yielded >= max_posts:
					return
			if not data.get("hasMore") or not data.get("cursor"):
				return
			cursor = str(data["cursor"])

	def iter_candidate_comments(
		self, post: dict[str, Any], candidate_username: str, limit: int
	) -> Iterator[dict[str, Any]]:
		"""Yield comments and replies written by the candidate under one video."""
		if not post.get("comment_count") or limit <= 0:
			return
		target = candidate_username.lower()
		cursor = 0
		found = 0
		pages = 0
		while found < limit and pages < 20:
			pages += 1
			data = self._get(
				"/api/comment/list/", {"aweme_id": post["pk"], "count": 50, "cursor": cursor}, post["url"]
			)
			for c in data.get("comments") or []:
				for item in self._comment_and_replies(post, c):
					if (item["author"] or "").lower() == target:
						found += 1
						yield item
						if found >= limit:
							return
			if not data.get("has_more"):
				return
			cursor = as_int(data.get("cursor")) or 0
			if not cursor:
				return

	def _comment_and_replies(self, post: dict[str, Any], c: dict[str, Any]) -> Iterator[dict[str, Any]]:
		yield self._normalize_comment(post, c, is_reply=False)
		replies = list(c.get("reply_comment") or [])
		if (as_int(c.get("reply_comment_total")) or 0) > len(replies) and c.get("cid"):
			try:
				data = self._get(
					"/api/comment/list/reply/",
					{"item_id": post["pk"], "comment_id": c["cid"], "count": 50, "cursor": 0},
					post["url"],
				)
				replies = data.get("comments") or replies
			except (TikTokRateLimited, ApiUnavailable):
				pass
		for r in replies:
			yield self._normalize_comment(post, r, is_reply=True)

	@staticmethod
	def _normalize_comment(post: dict[str, Any], c: dict[str, Any], is_reply: bool) -> dict[str, Any]:
		return {
			"author": (c.get("user") or {}).get("unique_id") or "",
			"snippet": snippet(c.get("text") or ""),
			"published_on": ts_to_str(c.get("create_time")),
			"url": f"{post['url']}?comment_id={c['cid']}" if c.get("cid") else post["url"],
			"media_type": "Text",
			"is_reply": is_reply,
		}

	def crawl_profile(
		self,
		username: str,
		max_posts: int,
		max_comments: int,
		earliest_ts: float | None,
		result: dict[str, Any],
		report: Callable[..., None],
	) -> None:
		report("{0} @{1}: reading profile", "TikTok", username)
		prof = self.profile(username)
		result.update(
			display_name=prof["display_name"],
			bio=prof["bio"],
			location="",
			is_private=prof["is_private"],
			followers_count=prof["followers_count"],
			following_count=prof["following_count"],
			posts_count=prof["posts_count"],
		)
		result["_profile_loaded"] = True
		if prof["is_private"]:
			result["comment_limitation"] = "Private profile: videos are only visible to approved followers."
			return
		for post in self.iter_posts(prof["sec_uid"], username, max_posts, earliest_ts):
			result["posts"].append(post)
			if len(result["posts"]) % 30 == 0:
				report("{0} @{1}: {2} posts read", "TikTok", username, len(result["posts"]))
		crawl_comments(self, "TikTok", username, result, max_comments, report)

