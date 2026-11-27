# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Threads crawler driven by a signed-in headless browser.

Threads answers anonymous server requests with HTTP 429, while a browser holding the crawler
account's session works. Posts come from the profile page, the candidate's replies from the
"Replies" tab. Everything is read from the JSON the page itself receives (embedded scripts plus
GraphQL responses), never from the rendered DOM.
"""

from __future__ import annotations

import json
import random
import re
import time
from collections.abc import Callable
from typing import Any

from sentra_ats.bgc.providers.social.api_base import (
	ProfileNotFound,
	RateLimited,
	SessionRejected,
	ts_to_str,
	walk,
	within_window,
)
from sentra_ats.bgc.providers.social.base import clean_snippet

BASE = "https://www.threads.com"
JSON_SCRIPT_RE = re.compile(r'<script[^>]+type="application/json"[^>]*>(.*?)</script>', re.DOTALL)
NOT_FOUND_MARKERS = ("sorry, this page isn't available", "halaman ini tidak tersedia", "page isn't available")


def thread_posts(payloads: list[Any]) -> list[dict[str, Any]]:
	"""Every Threads post object found in the payloads (dicts with a code, an author and text/caption)."""
	out: dict[str, dict[str, Any]] = {}
	for payload in payloads:
		for d in walk(payload):
			code = d.get("code")
			user = d.get("user")
			if not code or not isinstance(user, dict) or not user.get("username"):
				continue
			text = (d.get("caption") or {}).get("text") if isinstance(d.get("caption"), dict) else None
			if text is None:
				continue
			out.setdefault(str(code), d)
	return list(out.values())


def is_reply(post: dict[str, Any]) -> bool:
	info = post.get("text_post_app_info") or {}
	return bool(info.get("reply_to_author") or info.get("is_reply") or post.get("reply_to_author"))


def user_info(payloads: list[Any], username: str) -> dict[str, Any] | None:
	target = username.lower()
	best = None
	for payload in payloads:
		for d in walk(payload):
			if (d.get("username") or "").lower() == target and ("full_name" in d or "biography" in d):
				if best is None or (d.get("follower_count") is not None and best.get("follower_count") is None):
					best = d
	return best


class ThreadsBrowserClient:
	"""Same crawl_profile interface as the other social clients."""

	def __init__(
		self,
		storage_state: dict[str, Any],
		pause: tuple[float, float] = (0.8, 1.6),
		time_budget: int = 600,
		playwright_factory: Callable[[], Any] | None = None,
	):
		self.storage_state = storage_state
		self.pause = pause
		self.time_budget = time_budget
		self.playwright_factory = playwright_factory
		self.page = None
		self.payloads: list[Any] = []
		self.deadline = 0.0
		self.budget_hit = False

	def _on_response(self, resp: Any) -> None:
		if "graphql" not in resp.url and "/api/" not in resp.url:
			return
		try:
			self.payloads.append(resp.json())
		except Exception:
			pass

	def _goto(self, url: str) -> str:
		self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
		self.page.wait_for_timeout(int(random.uniform(*self.pause) * 1000) + 2000)
		cur = self.page.url
		if "/login" in cur or "/challenge" in cur:
			raise SessionRejected(f"redirected to {cur}")
		html = self.page.content()
		low = html[:200000].lower()
		if "please wait a few minutes" in low:
			raise RateLimited("Threads asked to wait a few minutes")
		# Embedded JSON blobs are payloads too
		for m in JSON_SCRIPT_RE.finditer(html):
			try:
				self.payloads.append(json.loads(m.group(1)))
			except ValueError:
				pass
		return html

	def _scroll_collect(self, max_items: int, rounds: int = 40) -> None:
		last = -1
		stale = 0
		for _ in range(rounds):
			if time.time() > self.deadline:
				self.budget_hit = True
				return
			n = len(thread_posts(self.payloads))
			if n >= max_items:
				return
			stale = stale + 1 if n == last else 0
			if stale >= 3:
				return
			last = n
			self.page.mouse.wheel(0, 5000)
			self.page.wait_for_timeout(int(random.uniform(*self.pause) * 1000) + 800)

	def crawl_profile(
		self,
		username: str,
		max_posts: int,
		max_comments: int,
		earliest_ts: float | None,
		result: dict[str, Any],
		report: Callable[..., None],
	) -> None:
		if self.playwright_factory:
			pw_cm = self.playwright_factory()
		else:
			from playwright.sync_api import sync_playwright

			pw_cm = sync_playwright()
		self.deadline = time.time() + self.time_budget
		result["mode_used"] = "session-browser"
		with pw_cm as pw:
			browser = pw.chromium.launch(
				headless=True,
				args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
			)
			try:
				ctx = browser.new_context(storage_state=self.storage_state, viewport={"width": 1280, "height": 900})
				self.page = ctx.new_page()
				self.page.on("response", self._on_response)
				self._crawl(username, max_posts, max_comments, earliest_ts, result, report)
			finally:
				browser.close()
		if self.budget_hit:
			note = "Time budget for this account was reached; data is partial."
			result["comment_limitation"] = " ".join(x for x in (result.get("comment_limitation"), note) if x)

	def _own(self, username: str, replies: bool) -> list[dict[str, Any]]:
		target = username.lower()
		return [
			p for p in thread_posts(self.payloads)
			if (p["user"].get("username") or "").lower() == target and is_reply(p) == replies
		]

	def _crawl(self, username, max_posts, max_comments, earliest_ts, result, report) -> None:
		report("{0} @{1}: reading profile", "Threads", username)
		html = self._goto(f"{BASE}/@{username}")
		if any(m in html[:300000].lower() for m in NOT_FOUND_MARKERS) and not user_info(self.payloads, username):
			raise ProfileNotFound(username)
		info = user_info(self.payloads, username) or {}
		result.update(
			display_name=info.get("full_name") or "",
			bio=info.get("biography") or "",
			location="",
			is_private=bool(info.get("is_private")),
			followers_count=info.get("follower_count"),
			following_count=None,
			posts_count=None,
		)
		result["_profile_loaded"] = True

		self._scroll_collect(max_posts)
		for p in sorted(self._own(username, False), key=lambda x: x.get("taken_at") or 0, reverse=True):
			if not within_window(p.get("taken_at"), earliest_ts):
				continue
			if len(result["posts"]) >= max_posts:
				break
			result["posts"].append(self._item(p, username, "Post"))
		report("{0} @{1}: {2} posts read", "Threads", username, len(result["posts"]))

		if max_comments > 0 and time.time() < self.deadline:
			report("{0} @{1}: reading replies", "Threads", username)
			self._goto(f"{BASE}/@{username}/replies")
			self._scroll_collect(max_comments)
			for p in sorted(self._own(username, True), key=lambda x: x.get("taken_at") or 0, reverse=True):
				if not within_window(p.get("taken_at"), earliest_ts):
					continue
				if len(result["comments"]) >= max_comments:
					break
				result["comments"].append(self._item(p, username, "Comment"))

	@staticmethod
	def _item(p: dict[str, Any], username: str, kind: str) -> dict[str, Any]:
		return {
			"snippet": clean_snippet((p.get("caption") or {}).get("text") or ""),
			"published_on": ts_to_str(p.get("taken_at")),
			"url": f"{BASE}/@{username}/post/{p.get('code')}",
			"media_type": "Text",
			"is_reply": kind == "Comment",
		}
