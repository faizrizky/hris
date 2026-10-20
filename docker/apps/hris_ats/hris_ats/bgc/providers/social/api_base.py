# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Shared plumbing for the signed-in social web API clients (Instagram, TikTok, Facebook, LinkedIn).

Profile HTML of these platforms no longer carries posts; they load over authenticated XHR. Each
client takes the crawler account's decrypted session cookies, paces its requests and exposes
``crawl_profile`` which fills a result dict in place, so data read before a rate limit survives.
"""

from __future__ import annotations

import json
import random
import time
from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Any

from hris_ats.bgc.providers.social.base import clean_snippet

MENTION = "@[user]"


class SocialApiError(Exception):
	"""Base class for errors raised by the social API clients."""


class SessionRejected(SocialApiError):
	"""The session is not signed in (anymore) or the platform asked for a checkpoint/captcha."""


class RateLimited(SocialApiError):
	"""The platform asked us to slow down."""


class ProfileNotFound(SocialApiError):
	"""The profile does not exist (or is banned)."""


class ApiUnavailable(SocialApiError):
	"""The endpoint refused the request for a reason other than session or rate (e.g. signing, schema change)."""


def default_http_get(url: str, headers: dict[str, str], cookies: dict[str, str], timeout: int) -> tuple[int, str]:
	from scrapling.fetchers import Fetcher

	res = Fetcher.get(url, impersonate="chrome", stealthy_headers=True, headers=headers, cookies=cookies, timeout=timeout)
	return res.status, _body(res)


def default_http_post(
	url: str, data: dict[str, str], headers: dict[str, str], cookies: dict[str, str], timeout: int
) -> tuple[int, str]:
	from scrapling.fetchers import Fetcher

	res = Fetcher.post(
		url, data=data, impersonate="chrome", stealthy_headers=True, headers=headers, cookies=cookies, timeout=timeout
	)
	return res.status, _body(res)


def _body(res: Any) -> str:
	return res.body.decode("utf-8", "ignore") if isinstance(res.body, bytes) else str(res.body or "")


def ts_to_str(ts: float | int | None) -> str | None:
	"""Epoch seconds to the 'YYYY-MM-DD HH:MM:SS' string used by findings."""
	try:
		ts = float(ts or 0)
	except (TypeError, ValueError):
		return None
	return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S") if ts > 0 else None


def mask_ranges(text: str, ranges: list[tuple[int, int]]) -> str:
	"""Replace [offset, offset+length) spans (third-party mentions tagged by the platform) with @[user]."""
	if not text or not ranges:
		return text or ""
	from hris_ats.bgc.providers.social.base import mentions_anonymized

	if not mentions_anonymized():
		return text
	out = text
	for start, length in sorted({(int(s), int(n)) for s, n in ranges if n and int(n) > 0}, reverse=True):
		if 0 <= start < len(out):
			out = out[:start] + MENTION + out[start + length :]
	return out


def snippet(text: str, mention_ranges: list[tuple[int, int]] | None = None) -> str:
	return clean_snippet(mask_ranges(text or "", mention_ranges or []))


def parse_json(body: str) -> Any:
	"""Lenient JSON: strips Facebook's 'for (;;);' guard; returns None on garbage."""
	if not body:
		return None
	body = body.strip()
	if body.startswith("for (;;);"):
		body = body[9:]
	try:
		return json.loads(body)
	except ValueError:
		return None


def walk(node: Any) -> Iterator[dict[str, Any]]:
	"""Yield every dict nested anywhere inside node (depth first, document order)."""
	stack = [node]
	while stack:
		cur = stack.pop()
		if isinstance(cur, dict):
			yield cur
			stack.extend(reversed(list(cur.values())))
		elif isinstance(cur, list):
			stack.extend(reversed(cur))


def find_key(node: Any, key: str) -> Any:
	"""First value stored under key anywhere inside node (document order), or None."""
	for d in walk(node):
		if key in d and d[key] not in (None, "", [], {}):
			return d[key]
	return None


class PacedApiClient:
	"""Request pacing, call counting and injectable HTTP for unit tests."""

	def __init__(
		self,
		cookies: dict[str, str],
		http_get: Callable[..., tuple[int, str]] | None = None,
		http_post: Callable[..., tuple[int, str]] | None = None,
		pause: tuple[float, float] = (0.8, 2.0),
		sleep_fn: Callable[[float], None] = time.sleep,
		timeout: int = 20,
	):
		self.cookies = cookies
		self.http_get = http_get or default_http_get
		self.http_post = http_post or default_http_post
		self.pause = pause
		self.sleep_fn = sleep_fn
		self.timeout = timeout
		self.requests_made = 0

	def _pace(self) -> None:
		if self.requests_made:
			self.sleep_fn(random.uniform(*self.pause))
		self.requests_made += 1

	def _raw_get(self, url: str, headers: dict[str, str], cookies: dict[str, str] | None = None) -> tuple[int, str]:
		self._pace()
		return self.http_get(url, headers, self.cookies if cookies is None else cookies, self.timeout)

	def _raw_post(self, url: str, data: dict[str, str], headers: dict[str, str]) -> tuple[int, str]:
		self._pace()
		return self.http_post(url, data, headers, self.cookies, self.timeout)


def within_window(ts: float | None, earliest_ts: float | None) -> bool:
	return not (earliest_ts and ts and ts < earliest_ts)


def as_int(v: Any) -> int | None:
	try:
		return int(v)
	except (TypeError, ValueError):
		return None


def crawl_comments(
	client: Any, platform: str, username: str, result: dict[str, Any], max_comments: int, report: Callable[..., None]
) -> None:
	"""Candidate comments under the posts already in result['posts'], bounded by max_comments."""
	remaining = max_comments
	with_comments = [p for p in result["posts"] if p.get("comment_count")]
	for i, post in enumerate(with_comments, 1):
		if remaining <= 0:
			break
		for c in client.iter_candidate_comments(post, username, remaining):
			result["comments"].append(c)
			remaining -= 1
		if i % 10 == 0:
			report("{0} @{1}: comments checked on {2}/{3} posts", platform, username, i, len(with_comments))
