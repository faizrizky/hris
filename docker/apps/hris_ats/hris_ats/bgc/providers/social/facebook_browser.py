# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Facebook crawler driven by a signed-in headless browser.

Facebook's GraphQL persisted-query ids rotate and the web app refuses hand-built requests
("missing_required_variable_value"). A real browser sends valid requests by itself while it scrolls, so
this client loads the profile, scrolls, and reads the stories the page receives (embedded JSON plus
/api/graphql responses). Stories are normalised by FacebookApiClient (owner-only, mention handling);
the candidate's own comments come from each post's page.
"""

from __future__ import annotations

import random
import re
import time
from collections.abc import Callable
from typing import Any

from hris_ats.bgc.providers.social.api_base import (
	ProfileNotFound,
	RateLimited,
	SessionRejected,
	parse_json,
	walk,
	within_window,
)
from hris_ats.bgc.providers.social.facebook_api import (
	BASE,
	JSON_SCRIPT_RE,
	NOT_FOUND_MARKERS,
	OWNER_NAME_RE,
	PROFILE_ID_RES,
	TITLE_RE,
	FacebookApiClient,
)


def collect_blobs(html: str | None, graphql_bodies: list[str]) -> list[Any]:
	blobs: list[Any] = []
	if html:
		for m in JSON_SCRIPT_RE.finditer(html):
			j = parse_json(m.group(1))
			if j is not None:
				blobs.append(j)
	for body in graphql_bodies:
		for line in (body or "").split("\n"):
			j = parse_json(line)
			if j is not None:
				blobs.append(j)
	return blobs


def story_nodes(blobs: list[Any]) -> list[dict[str, Any]]:
	return [d for d in walk(blobs) if d.get("__typename") == "Story" and (d.get("post_id") or d.get("id"))]


def comment_total(story: dict[str, Any]) -> int:
	"""Largest comment total found in the story (several nested feedback objects carry their own counts)."""
	best = 0
	for d in walk(story):
		comments = d.get("comments")
		if isinstance(comments, dict) and isinstance(comments.get("total_count"), int):
			best = max(best, comments["total_count"])
	return best


class FacebookBrowserClient:
	"""Same crawl_profile interface as the other social clients."""

	def __init__(
		self,
		storage_state: dict[str, Any],
		pause: tuple[float, float] = (0.8, 1.6),
		time_budget: int = 600,
		post_budget: int = 25,
		max_comment_posts: int = 40,
		playwright_factory: Callable[[], Any] | None = None,
	):
		self.storage_state = storage_state
		self.pause = pause
		self.time_budget = time_budget
		self.post_budget = post_budget
		self.max_comment_posts = max_comment_posts
		self.playwright_factory = playwright_factory
		self.page = None
		self.bodies: list[str] = []
		self.deadline = 0.0
		self.budget_hit = False
		self.helper = FacebookApiClient({})

	def _on_response(self, resp: Any) -> None:
		if "/api/graphql" not in resp.url:
			return
		try:
			self.bodies.append(resp.text())
		except Exception:
			pass

	def _goto(self, url: str, settle: float = 4.5) -> str:
		self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
		self.page.wait_for_timeout(int(settle * 1000))
		cur = self.page.url
		if "/login" in cur or "/checkpoint" in cur:
			raise SessionRejected(f"redirected to {cur}")
		html = self.page.content()
		low = html[:300000].lower()
		if 'id="login_form"' in low:
			raise SessionRejected("not signed in")
		if "temporarily blocked" in low or "you're temporarily blocked" in low:
			raise RateLimited("Facebook temporarily limited this account")
		return html

	def _time_left(self) -> bool:
		if time.time() > self.deadline:
			self.budget_hit = True
			return False
		return True

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
				ctx = browser.new_context(
					storage_state=self.storage_state, viewport={"width": 1280, "height": 900}, locale="en-US"
				)
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
		report("{0} @{1}: reading profile", "Facebook", username)
		url = FacebookApiClient.profile_url(username)
		html = self._goto(url)
		low = html[:400000].lower()
		profile_id = username if username.isdigit() else ""
		for rx in PROFILE_ID_RES:
			if profile_id:
				break
			m = rx.search(html)
			profile_id = m.group(1) if m else ""
		if not profile_id:
			if any(k in low for k in NOT_FOUND_MARKERS):
				raise ProfileNotFound(username)
			raise SessionRejected("profile id not found (page not available for this account)")
		name_m = OWNER_NAME_RE.search(html)
		name = ""
		if name_m:
			from hris_ats.bgc.providers.social.facebook_api import _unescape

			name = _unescape(name_m.group(1))
		if not name:
			t = TITLE_RE.search(html)
			name = re.sub(r"\s*\|\s*Facebook\s*$", "", t.group(1)).strip() if t else ""
		page = {"id": profile_id, "url": url, "display_name": name}
		result.update(display_name=name, bio="", location="", is_private=False)
		result["_profile_loaded"] = True

		posts = self._collect_posts(html, page, max_posts, earliest_ts, report)
		report("{0} @{1}: {2} posts read", "Facebook", username, len(posts))

		remaining = max_comments
		visited = 0
		for post in posts:
			if remaining <= 0 or visited >= self.max_comment_posts or not self._time_left():
				break
			if not post["_comments"]:
				continue
			visited += 1
			got = self._post_comments(post, profile_id, remaining)
			result["comments"].extend(got)
			remaining -= len(got)
			if visited % 10 == 0:
				report("{0} @{1}: comments checked on {2} posts", "Facebook", username, visited)
		for p in posts:
			for k in ("_ts", "_pinned", "_story", "_comments"):
				p.pop(k, None)
			result["posts"].append(p)
		note = "Comments: only the candidate's comments found on the pages of their own posts."
		result["comment_limitation"] = " ".join(x for x in (result.get("comment_limitation"), note) if x)
		if not posts:
			result["comment_limitation"] = (
				"No posts visible to the crawler account (friends-only or empty timeline). "
				+ result["comment_limitation"]
			)

	def _collect_posts(self, html, page, max_posts, earliest_ts, report) -> list[dict[str, Any]]:
		by_pk: dict[str, dict[str, Any]] = {}
		stale = 0
		for round_no in range(80):
			blobs = collect_blobs(html if round_no == 0 else None, self.bodies)
			before = len(by_pk)
			for st in story_nodes(blobs):
				post = self.helper.normalize_story(st, page)
				if post is None or post["pk"] in by_pk:
					continue
				post["_comments"] = comment_total(st)
				by_pk[post["pk"]] = post
			ordered = sorted(by_pk.values(), key=lambda p: p["_ts"], reverse=True)
			in_window = [p for p in ordered if within_window(p["_ts"], earliest_ts)]
			reached_old = any(not p["_pinned"] and not within_window(p["_ts"], earliest_ts) for p in ordered)
			if len(in_window) >= max_posts or reached_old or not self._time_left():
				return in_window[:max_posts]
			stale = stale + 1 if len(by_pk) == before else 0
			if stale >= 4:
				return in_window[:max_posts]
			self.page.mouse.wheel(0, 6000)
			self.page.wait_for_timeout(int(random.uniform(*self.pause) * 1000) + 900)
		return [p for p in sorted(by_pk.values(), key=lambda p: p["_ts"], reverse=True) if within_window(p["_ts"], earliest_ts)][:max_posts]

	def _post_comments(self, post: dict[str, Any], owner_id: str, limit: int) -> list[dict[str, Any]]:
		self.bodies = []
		try:
			html = self._goto(post["url"], settle=3.5)
		except SessionRejected:
			raise
		except Exception:
			return []
		# Opening "most relevant" comments loads more of them; expanding is best effort
		for _ in range(3):
			if not self._time_left():
				break
			try:
				clicked = self.page.evaluate(
					"""() => { let n = 0;
						for (const el of document.querySelectorAll('div[role=button], span[role=button]')) {
							const t = (el.innerText || '').trim();
							if (t.length < 50 && /view more comments|view \\d+ more|more repl|lihat .*komentar|balasan/i.test(t) && !el.dataset.bgc) { el.dataset.bgc = '1'; el.click(); n++; }
						} return n; }"""
				)
			except Exception:
				clicked = 0
			if not clicked:
				break
			self.page.wait_for_timeout(1200)
		blobs = collect_blobs(html, self.bodies)
		return self.helper.candidate_comments({"_story": blobs, "url": post["url"]}, owner_id, limit)
