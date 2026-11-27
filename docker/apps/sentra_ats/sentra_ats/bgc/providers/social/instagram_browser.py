# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Instagram crawler that drives a real (headless) browser with the crawler account session.

Instagram answers direct calls to its REST endpoints from a server with HTTP 429 even when the
cookies are valid, while the same session in a browser works. So this client loads the profile and
post pages like a person would, reads the posts and comments the web app itself receives (embedded
page JSON plus GraphQL responses), and opens reply threads to find the candidate's own replies.
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
	crawl_comments,
	ts_to_str,
	walk,
	within_window,
)
from sentra_ats.bgc.providers.social.base import clean_snippet

BASE = "https://www.instagram.com"
MEDIA_TYPES = {1: "Photo", 2: "Video", 8: "Carousel"}
TIMELINE_KEY = "xdt_api__v1__feed__user_timeline_graphql_connection"
COMMENTS_KEY = "xdt_api__v1__media__media_id__comments__connection"
EXPAND_RE = re.compile(
	r"(view|lihat)\s+(all\s+|semua\s+)?(\d+\s+)?(more\s+)?(replies|reply|balasan)|load more comments|muat komentar lainnya",
	re.IGNORECASE,
)
NOT_FOUND_MARKERS = ("sorry, this page isn't available", "halaman ini tidak tersedia", "page not found")


def extract_embedded(html: str, key: str) -> list[Any]:
	"""Every JSON value stored under "key" in the page source (Instagram embeds its data as JSON)."""
	out: list[Any] = []
	dec = json.JSONDecoder()
	needle = f'"{key}":'
	i = html.find(needle)
	while i >= 0:
		try:
			obj, _end = dec.raw_decode(html, i + len(needle))
			out.append(obj)
		except ValueError:
			pass
		i = html.find(needle, i + len(needle))
	return out


def post_from_node(n: dict[str, Any], username: str) -> dict[str, Any] | None:
	code = n.get("code")
	if not code:
		return None
	taken = n.get("taken_at") or 0
	caption = (n.get("caption") or {}).get("text") or ""
	return {
		"pk": str(n.get("pk") or str(n.get("id") or "").split("_")[0]),
		"snippet": clean_snippet(caption) if caption else "",
		"published_on": ts_to_str(taken),
		"url": f"{BASE}/p/{code}/",
		"media_type": MEDIA_TYPES.get(n.get("media_type"), "Photo"),
		"comment_count": int(n.get("comment_count") or 0),
		"_taken_at": taken,
		"_pinned": bool(n.get("timeline_pinned_user_ids")),
	}


def comment_nodes(payload: Any) -> list[dict[str, Any]]:
	"""Comment objects anywhere in a payload: they carry pk, text, created_at and a user."""
	return [
		d for d in walk(payload)
		if "text" in d and "created_at" in d and isinstance(d.get("user"), dict) and d.get("pk")
	]


class InstagramBrowserClient:
	"""Same crawl_profile interface as the API clients, backed by Playwright."""

	def __init__(
		self,
		storage_state: dict[str, Any],
		pause: tuple[float, float] = (0.8, 1.6),
		time_budget: int = 600,
		post_budget: int = 25,
		playwright_factory: Callable[[], Any] | None = None,
	):
		self.storage_state = storage_state
		self.pause = pause
		self.time_budget = time_budget
		self.post_budget = post_budget
		self.playwright_factory = playwright_factory
		self.page = None
		self.payloads: list[Any] = []
		self.deadline = 0.0
		self.budget_hit = False

	# --- browser plumbing -------------------------------------------------
	def _on_response(self, resp: Any) -> None:
		url = resp.url
		if "graphql" not in url and "/api/v1/" not in url:
			return
		try:
			self.payloads.append(resp.json())
		except Exception:
			pass

	def _wait_for_key(self, key: str, max_seconds: float) -> None:
		"""Stop waiting as soon as the page source holds the data we need instead of sleeping a fixed time."""
		end = time.time() + max_seconds
		while time.time() < end:
			try:
				if self.page.evaluate("(k) => document.documentElement.innerHTML.includes(k)", key):
					return
			except Exception:
				pass
			self.page.wait_for_timeout(250)

	def _goto(self, url: str, wait_key: str | None = None) -> str:
		self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
		if wait_key:
			self._wait_for_key(wait_key, 8)
		else:
			self.page.wait_for_timeout(int(random.uniform(*self.pause) * 1000) + 1500)
		cur = self.page.url
		if "/accounts/login" in cur or "/challenge" in cur or "/suspended" in cur:
			raise SessionRejected(f"redirected to {cur}")
		html = self.page.content()
		low = html[:200000].lower()
		if "please wait a few minutes" in low or "tunggu beberapa menit" in low:
			raise RateLimited("Instagram asked to wait a few minutes")
		return html

	def _time_left(self) -> bool:
		if time.time() > self.deadline:
			self.budget_hit = True
			return False
		return True

	# --- crawl -------------------------------------------------------------
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
				# Pictures, video and fonts are not needed to read the page's JSON and slow every page load
				ctx.route(
					"**/*",
					lambda route: route.abort()
					if route.request.resource_type in ("image", "media", "font")
					else route.continue_(),
				)
				self.page = ctx.new_page()
				self.page.on("response", self._on_response)
				self._crawl(username, max_posts, max_comments, earliest_ts, result, report)
			finally:
				browser.close()
		if self.budget_hit:
			note = "Time budget for this account was reached; data is partial."
			result["comment_limitation"] = " ".join(x for x in (result.get("comment_limitation"), note) if x)

	def _crawl(self, username, max_posts, max_comments, earliest_ts, result, report) -> None:
		report("{0} @{1}: reading profile", "Instagram", username)
		html = self._goto(f"{BASE}/{username}/", wait_key=TIMELINE_KEY)
		if any(m in html[:300000].lower() for m in NOT_FOUND_MARKERS) and TIMELINE_KEY not in html:
			raise ProfileNotFound(username)

		user = self._profile_user(username)
		if user:
			result.update(
				display_name=user.get("full_name") or "",
				bio=user.get("biography") or "",
				location="",
				is_private=bool(user.get("is_private")),
				followers_count=user.get("follower_count"),
				following_count=user.get("following_count"),
				posts_count=user.get("media_count"),
			)
		else:
			# Fallback: Open Graph tags (no privacy flag available there)
			from sentra_ats.bgc.providers.social.instagram import InstagramAdapter

			prof = InstagramAdapter().parse_profile(html, url=self.page.url)
			result.update(
				display_name=prof.get("display_name") or "",
				bio=prof.get("bio") or "",
				location="",
				is_private=bool(prof.get("is_private")),
				followers_count=prof.get("followers_count"),
				following_count=prof.get("following_count"),
				posts_count=prof.get("posts_count"),
			)
		result["_profile_loaded"] = True

		posts = self._collect_posts(html, username, max_posts, earliest_ts, report)
		result["posts"].extend(posts)
		report("{0} @{1}: {2} posts read", "Instagram", username, len(posts))
		crawl_comments(self, "Instagram", username, result, max_comments, report)
		for p in result["posts"]:
			p.pop("_taken_at", None)
			p.pop("_pinned", None)
		if result["is_private"] and not result["posts"]:
			result["comment_limitation"] = "Private profile: posts are only visible to approved followers."

	def _profile_user(self, username: str) -> dict[str, Any] | None:
		"""The profile owner's user object from the GraphQL responses (richest one wins)."""
		target = username.lower()
		best = None
		for payload in self.payloads:
			for d in walk(payload):
				if (d.get("username") or "").lower() == target and "full_name" in d:
					if best is None or (d.get("follower_count") is not None and best.get("follower_count") is None):
						best = d
		return best

	def _timeline_nodes(self, html: str | None) -> tuple[list[dict[str, Any]], bool]:
		conns = extract_embedded(html, TIMELINE_KEY) if html else []
		for payload in self.payloads:
			for d in walk(payload):
				if TIMELINE_KEY in d and isinstance(d[TIMELINE_KEY], dict):
					conns.append(d[TIMELINE_KEY])
		nodes, has_next = [], False
		for c in conns:
			if not isinstance(c, dict):
				continue
			has_next = has_next or bool((c.get("page_info") or {}).get("has_next_page"))
			nodes.extend(e.get("node") for e in (c.get("edges") or []) if isinstance(e, dict) and e.get("node"))
		return nodes, has_next

	def _collect_posts(self, html, username, max_posts, earliest_ts, report) -> list[dict[str, Any]]:
		by_code: dict[str, dict[str, Any]] = {}
		stale_rounds = 0
		for _round in range(60):
			nodes, has_next = self._timeline_nodes(html if _round == 0 else None)
			before = len(by_code)
			for n in nodes:
				p = post_from_node(n, username)
				if p and p["url"] not in by_code:
					by_code[p["url"]] = p
			posts = sorted(by_code.values(), key=lambda p: p["_taken_at"], reverse=True)
			in_window = [p for p in posts if within_window(p["_taken_at"], earliest_ts)]
			reached_old = any(not p["_pinned"] and not within_window(p["_taken_at"], earliest_ts) for p in posts)
			if len(in_window) >= max_posts or reached_old or not has_next or not self._time_left():
				return in_window[:max_posts]
			stale_rounds = stale_rounds + 1 if len(by_code) == before else 0
			if stale_rounds >= 3:
				return in_window[:max_posts]
			if len(by_code) != before and len(by_code) % 12 == 0:
				report("{0} @{1}: {2} posts read", "Instagram", username, len(by_code))
			self.page.mouse.wheel(0, 5000)
			self.page.wait_for_timeout(int(random.uniform(*self.pause) * 1000) + 800)
		return [p for p in sorted(by_code.values(), key=lambda p: p["_taken_at"], reverse=True)
		        if within_window(p["_taken_at"], earliest_ts)][:max_posts]

	def iter_candidate_comments(self, post: dict[str, Any], candidate_username: str, limit: int):
		"""Open the post, expand reply threads and yield comments written by the candidate."""
		if limit <= 0 or not self._time_left():
			return
		target = candidate_username.lower()
		self.payloads = []
		html = self._goto(post["url"], wait_key=COMMENTS_KEY)
		post_deadline = time.time() + self.post_budget
		# The page data arrives before the UI hydrates; reply buttons only exist after a comment is on screen
		first = next((c for c in comment_nodes(extract_embedded(html, COMMENTS_KEY)) if c.get("text")), None)
		if first:
			probe = (first["text"] or "")[:12]
			end = time.time() + 6
			while time.time() < end:
				try:
					if self.page.evaluate("(t) => document.body.innerText.includes(t)", probe):
						break
				except Exception:
					pass
				self.page.wait_for_timeout(250)
		for _ in range(15):
			if time.time() > post_deadline or not self._time_left():
				break
			before = len(self.payloads)
			clicked = self.page.evaluate(
				"""(src) => {
					const re = new RegExp(src, 'i');
					let n = 0;
					for (const el of document.querySelectorAll('span, div[role=button], button')) {
						const t = (el.innerText || el.getAttribute('aria-label') || '').trim();
						if (t.length < 60 && re.test(t) && !el.dataset.bgcClicked) {
							el.dataset.bgcClicked = '1'; el.click(); n++;
						}
					}
					return n;
				}""",
				EXPAND_RE.pattern,
			)
			if not clicked:
				break
			# Wait for the replies the click requested instead of sleeping a fixed time
			end = time.time() + 4
			while time.time() < end and len(self.payloads) <= before:
				self.page.wait_for_timeout(200)
			self.page.wait_for_timeout(400)

		seen: set[str] = set()
		found = 0
		sources = extract_embedded(html, COMMENTS_KEY) + self.payloads
		for c in comment_nodes(sources):
			pk = str(c.get("pk"))
			if pk in seen:
				continue
			seen.add(pk)
			if (c["user"].get("username") or "").lower() != target:
				continue
			found += 1
			yield {
				"author": c["user"].get("username"),
				"snippet": clean_snippet(c.get("text") or ""),
				"published_on": ts_to_str(c.get("created_at")),
				"url": f"{post['url']}c/{pk}/",
				"media_type": "Text",
				"is_reply": bool(c.get("parent_comment_id")),
			}
			if found >= limit:
				return
