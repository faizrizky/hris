# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Instagram web API client used with a signed-in crawler account session.

Profile HTML no longer contains posts (they load over XHR), so posts and the candidate's own
comments are read from the same JSON endpoints the Instagram web app uses. Every call is paced,
bounded by max_posts / max_comments / lookback, and stops on the first sign of a login wall or
rate limit so the crawler account is not pushed into a checkpoint.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Any

from sentra_ats.bgc.providers.social.api_base import (
	PacedApiClient,
	ProfileNotFound,
	RateLimited,
	SessionRejected,
	crawl_comments,
)
from sentra_ats.bgc.providers.social.base import clean_snippet

IG_APP_ID = "936619743392459"
BASE = "https://www.instagram.com"
MEDIA_TYPES = {1: "Photo", 2: "Video", 8: "Carousel"}


class InstagramSessionError(SessionRejected):
	"""The session is not signed in (anymore) or Instagram asked for a checkpoint."""


class InstagramRateLimited(RateLimited):
	"""Instagram asked us to slow down."""


class InstagramNotFound(ProfileNotFound):
	"""The profile does not exist."""


class InstagramApiClient(PacedApiClient):
	def _get(self, path: str, referer: str) -> dict[str, Any]:
		headers = {
			"x-ig-app-id": IG_APP_ID,
			"x-requested-with": "XMLHttpRequest",
			"x-csrftoken": self.cookies.get("csrftoken", ""),
			"referer": referer,
			"accept": "*/*",
		}
		status, body = self._raw_get(BASE + path, headers)
		try:
			data = json.loads(body) if body else {}
		except ValueError:
			data = {}
		message = str(data.get("message") or "").lower()
		if status == 404:
			raise InstagramNotFound(path)
		if status == 429 or "please wait" in message:
			raise InstagramRateLimited(data.get("message") or f"HTTP {status}")
		if status in (401, 403) or data.get("require_login") or "checkpoint" in message or "login_required" in message:
			raise InstagramSessionError(data.get("message") or f"HTTP {status}")
		if status != 200 or not isinstance(data, dict):
			raise InstagramRateLimited(f"HTTP {status}")
		return data

	def profile(self, username: str) -> dict[str, Any]:
		data = self._get(f"/api/v1/users/web_profile_info/?username={username}", f"{BASE}/{username}/")
		user = (data.get("data") or {}).get("user")
		if not user:
			raise InstagramNotFound(username)
		return {
			"id": user.get("id"),
			"username": user.get("username") or username,
			"display_name": user.get("full_name") or "",
			"bio": user.get("biography") or "",
			"is_private": bool(user.get("is_private")),
			"followers_count": (user.get("edge_followed_by") or {}).get("count"),
			"following_count": (user.get("edge_follow") or {}).get("count"),
			"posts_count": (user.get("edge_owner_to_timeline_media") or {}).get("count"),
			"external_url": user.get("external_url") or "",
		}

	def iter_posts(self, user_id: str, username: str, max_posts: int, earliest_ts: float | None) -> Iterator[dict[str, Any]]:
		"""Yield normalized posts newest first until max_posts or the lookback window is reached."""
		max_id = ""
		yielded = 0
		while yielded < max_posts:
			q = f"/api/v1/feed/user/{user_id}/?count=12" + (f"&max_id={max_id}" if max_id else "")
			data = self._get(q, f"{BASE}/{username}/")
			items = data.get("items") or []
			for it in items:
				taken = it.get("taken_at") or 0
				if earliest_ts and taken and taken < earliest_ts:
					# Pinned posts can be older than the window and appear first; skip instead of stopping
					if it.get("timeline_pinned_user_ids"):
						continue
					return
				caption = (it.get("caption") or {}).get("text") or ""
				code = it.get("code") or ""
				yield {
					"pk": str(it.get("pk") or it.get("id", "").split("_")[0]),
					"snippet": clean_snippet(caption) if caption else "",
					"published_on": datetime.fromtimestamp(taken).strftime("%Y-%m-%d %H:%M:%S") if taken else None,
					"url": f"{BASE}/p/{code}/" if code else f"{BASE}/{username}/",
					"media_type": MEDIA_TYPES.get(it.get("media_type"), "Photo"),
					"comment_count": int(it.get("comment_count") or 0),
				}
				yielded += 1
				if yielded >= max_posts:
					return
			if not data.get("more_available") or not data.get("next_max_id"):
				return
			max_id = data["next_max_id"]

	def iter_candidate_comments(
		self, post: dict[str, Any], candidate_username: str, limit: int
	) -> Iterator[dict[str, Any]]:
		"""Yield comments and replies written by the candidate under one post."""
		if not post.get("comment_count") or limit <= 0:
			return
		target = candidate_username.lower()
		referer = post["url"]
		min_id = ""
		found = 0
		pages = 0
		while found < limit and pages < 20:
			pages += 1
			q = f"/api/v1/media/{post['pk']}/comments/?can_support_threading=true&permalink_enabled=false"
			if min_id:
				q += f"&min_id={min_id}"
			data = self._get(q, referer)
			for c in data.get("comments") or []:
				for item in self._comment_and_replies(post, c, referer):
					if (item["author"] or "").lower() == target:
						found += 1
						yield item
						if found >= limit:
							return
			if not data.get("has_more_headload_comments") and not data.get("next_min_id"):
				return
			min_id = data.get("next_min_id") or ""
			if not min_id:
				return

	def _comment_and_replies(self, post: dict[str, Any], c: dict[str, Any], referer: str) -> Iterator[dict[str, Any]]:
		yield self._normalize_comment(post, c, is_reply=False)
		children = list(c.get("preview_child_comments") or [])
		if (c.get("child_comment_count") or 0) > len(children):
			try:
				data = self._get(f"/api/v1/media/{post['pk']}/comments/{c.get('pk')}/child_comments/", referer)
				children = data.get("child_comments") or children
			except InstagramRateLimited:
				pass
		for ch in children:
			yield self._normalize_comment(post, ch, is_reply=True)

	@staticmethod
	def _normalize_comment(post: dict[str, Any], c: dict[str, Any], is_reply: bool) -> dict[str, Any]:
		created = c.get("created_at") or c.get("created_at_utc") or 0
		return {
			"author": (c.get("user") or {}).get("username") or "",
			"snippet": clean_snippet(c.get("text") or ""),
			"published_on": datetime.fromtimestamp(created).strftime("%Y-%m-%d %H:%M:%S") if created else None,
			"url": f"{post['url']}c/{c.get('pk')}/" if c.get("pk") else post["url"],
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
		report("{0} @{1}: reading profile", "Instagram", username)
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
		for post in self.iter_posts(prof["id"], username, max_posts, earliest_ts):
			result["posts"].append(post)
			if len(result["posts"]) % 12 == 0:
				report("{0} @{1}: {2} posts read", "Instagram", username, len(result["posts"]))
		crawl_comments(self, "Instagram", username, result, max_comments, report)
		if prof["is_private"] and not result["posts"]:
			result["comment_limitation"] = "Private profile: posts are only visible to approved followers."
