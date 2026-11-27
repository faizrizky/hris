# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import dataclasses
import json
import re
from typing import Any

import frappe
from frappe import _
from frappe.utils import add_months, cint, now_datetime

from sentra_ats.bgc import fetch as bgc_fetch
from sentra_ats.bgc.consent import assert_social_consent
from sentra_ats.bgc.fetch import FetchConfig, FetchResult, get_fetch_config_from_settings
from sentra_ats.bgc.providers.base import BaseProvider
from sentra_ats.bgc.providers.social import get_social_adapter


class SocialPublicProvider(BaseProvider):
	name: str = "SocialPublicProvider"

	def __init__(self, config: FetchConfig | None = None, rate_limit_per_minute: int = 30):
		super().__init__(config=config, rate_limit_per_minute=rate_limit_per_minute)

	def crawl_account(
		self,
		bgc: Any,
		account: Any,
		is_mock: bool = False,
		max_posts: int = 200,
		max_comments: int = 200,
		lookback_months: int | None = 0,
		raw_fetch_fn: Any = None,
		progress: Any = None,
		use_session: bool = True,
	) -> dict[str, Any]:
		"""Mengambil profil, postingan, dan komentar publik media sosial sesuai kepatuhan penuh PDP & ToS.

		Langkah:
		1. assert_social_consent(bgc, account) wajib lulus sebelum ada aktivitas jaringan.
		2. Ambil halaman lewat fetch() dengan auto-escalation dan sesi akun crawler jika berhak.
		3. Urai profil, postingan, dan komentar melalui adapter spesifik platform.
		4. Anonimkan pihak ketiga (@[user]), batasi ke max_posts, max_comments, dan lookback_months.
		"""
		# 1. Penjaga persetujuan kandidat terpusat (Spesifikasi 3.1 & 3b)
		assert_social_consent(bgc, account)

		platform_name = getattr(account, "platform", "") or (account.get("platform", "") if isinstance(account, dict) else "")
		username = getattr(account, "username", "") or (account.get("username", "") if isinstance(account, dict) else "")
		adapter = get_social_adapter(platform_name)
		if not adapter:
			return {
				"status": "Failed",
				"error": _("Unsupported social media platform: {0}").format(platform_name),
				"posts": [],
				"comments": [],
			}

		clean_user = username.strip().lstrip("@")
		url_tmpl = None
		if getattr(frappe, "local", None) and getattr(frappe.local, "site", None) and getattr(frappe, "db", None):
			try:
				url_tmpl = frappe.db.get_value("Background Check Platform", platform_name, "profile_url_template")
			except Exception:
				url_tmpl = None
		profile_url = url_tmpl.replace("{username}", clean_user) if url_tmpl else adapter.build_profile_url(clean_user)

		if is_mock or not profile_url:
			return {
				"status": "Success",
				"profile_url": profile_url,
				"display_name": getattr(account, "display_name", "") or clean_user,
				"bio": "Software Engineer & Designer",
				"location": "Jakarta",
				"followers_count": 1250,
				"following_count": 350,
				"posts_count": 15,
				"mode_used": "mock",
				"crawler_account": None,
				"provenance": "Crawled",
				"comment_limitation": None,
				"posts": [
					{
						"finding_type": "Post",
						"snippet": f"Sharing our tech architecture update today. Collaboration with @[user] was amazing! #{clean_user}",
						"published_on": str(now_datetime()),
						"url": f"{profile_url}/p/1",
						"media_type": "Photo",
						"provenance": "Crawled",
						"account": getattr(account, "name", "") if hasattr(account, "name") else "",
						"platform": platform_name,
					}
				],
				"comments": [
					{
						"finding_type": "Comment",
						"snippet": "Thank you @[user] for the insightful perspective on software engineering!",
						"published_on": str(now_datetime()),
						"url": f"{profile_url}/p/1#c1",
						"media_type": "Text",
						"provenance": "Crawled",
						"is_reply": True,
						"account": getattr(account, "name", "") if hasattr(account, "name") else "",
						"platform": platform_name,
					}
				],
			}

		# 2. Ambil halaman web dengan eskalasi mode
		cfg = self.config or get_fetch_config_from_settings()
		if not use_session:
			cfg = dataclasses.replace(cfg, use_login_session=False)

		# 2a. Post dan komentar hanya tersedia lewat API web platform dengan sesi akun crawler yang login
		if use_session and platform_name in API_PLATFORMS and raw_fetch_fn is None and getattr(cfg, "use_login_session", False):
			api_res = self._crawl_via_api(
				platform_name, account, profile_url, clean_user, max_posts, max_comments, lookback_months, progress
			)
			if api_res is not None:
				incomplete = api_res.pop("_partial", False) or (api_res.get("status") == "Failed" and api_res.get("error") != "not found")
				if not incomplete:
					return api_res
				# Sesi login berhenti di tengah atau gagal: lengkapi dengan data publik (tanpa login), tanpa duplikasi
				if progress:
					progress(_("{0}: login session data is incomplete, adding public data").format(platform_name))
				public_res = self.crawl_account(
					bgc, account, is_mock, max_posts, max_comments, lookback_months, raw_fetch_fn, progress, use_session=False
				)
				return merge_crawl_results(api_res, public_res, int(max_posts or 200), int(max_comments or 200))

		# Cek apakah ada akun crawler untuk platform ini
		crawler_account_label = None
		if cfg.storage_state is None and getattr(cfg, "auto_escalate", False):
			from sentra_ats.bgc.crawler_session import get_crawler_account_for_platform
			c_acc = get_crawler_account_for_platform(platform_name)
			if c_acc:
				crawler_account_label = getattr(c_acc, "account_label", None) or getattr(c_acc, "name", None)

		fetch_res: FetchResult = bgc_fetch.fetch(
			profile_url,
			config=cfg,
			raw_fetch_fn=raw_fetch_fn,
		)

		# 3. Urai isi respons dengan adapter
		parsed = adapter.parse_profile(fetch_res.body, url=fetch_res.url)

		# Platform modern mengirim HTML kosong (200) ke klien non-browser; post baru muncul setelah JS dirender
		if not parsed.get("posts") and parsed.get("status") != "Failed" and cfg.stealth and "stealth" not in fetch_res.mode_used:
			rendered = bgc_fetch.fetch(
				profile_url, config=dataclasses.replace(cfg, auto_escalate=False), raw_fetch_fn=raw_fetch_fn
			)
			if "stealth" in rendered.mode_used and rendered.status == 200 and not rendered.is_blocked:
				rendered.mode_used = f"{fetch_res.mode_used}>{rendered.mode_used}"
				fetch_res = rendered
				parsed = adapter.parse_profile(fetch_res.body, url=fetch_res.url)

		has_session = "+session" in fetch_res.mode_used or ">session" in fetch_res.mode_used
		provenance = "Crawled (session)" if has_session else "Crawled"

		posts: list[dict[str, Any]] = []
		raw_posts = parsed.get("posts", [])

		# 4. Filter tanggal postingan berdasarkan lookback_months dan batasi max_posts
		earliest_date = add_months(now_datetime(), -int(lookback_months)) if lookback_months else None

		# Facebook tanpa login hanya merender 1-3 post; sisanya datang per batch GraphQL saat timeline di-scroll
		if (
			platform_name == "Facebook" and raw_fetch_fn is None and cfg.stealth and not has_session
			and parsed.get("status") != "Failed" and bgc_fetch.is_scrapling_browser_installed()
		):
			from sentra_ats.bgc.providers.social.facebook_browser import scroll_public_posts

			def report(template: str, *args: Any) -> None:
				if progress:
					progress(_(template).format(*args))

			report("Facebook: scrolling the public timeline")
			try:
				scrolled = scroll_public_posts(
					profile_url, int(max_posts or 200), earliest_date.timestamp() if earliest_date else None, report=report
				)
			except Exception as e:
				scrolled = []
				frappe.log_error(title="Facebook public scroll failed", message=str(e))
			if len(scrolled) > len(parsed.get("posts") or []):
				raw_posts = parsed["posts"] = scrolled
				fetch_res.mode_used = f"{fetch_res.mode_used}+scroll"

		for p in raw_posts:
			if len(posts) >= int(max_posts or 200):
				break
			pub = p.get("published_on")
			if pub and earliest_date:
				try:
					from frappe.utils import get_datetime
					if get_datetime(pub) < get_datetime(earliest_date):
						continue
				except Exception:
					pass
			p_copy = dict(p)
			p_copy["finding_type"] = "Post"
			p_copy["provenance"] = provenance
			p_copy["account"] = getattr(account, "name", "") if hasattr(account, "name") else ""
			p_copy["platform"] = platform_name
			posts.append(p_copy)

		# 5. Ekstrak komentar yang ditulis kandidat sendiri
		raw_comments, comment_limitation = adapter.extract_candidate_comments(fetch_res.body, clean_user, url=fetch_res.url)
		# LinkedIn tanpa login: komentar hanya ada di halaman tiap post publik (±10 komentar teratas per post)
		if platform_name == "LinkedIn" and raw_fetch_fn is None and int(max_comments or 0) > 0:
			for p in [p for p in posts if "/posts/" in (p.get("url") or "")]:
				if len(raw_comments) >= int(max_comments):
					break
				try:
					page_res = bgc_fetch.fetch(p["url"], config=cfg)
				except Exception:
					continue
				raw_comments.extend(adapter.post_page_comments(page_res.body, clean_user, url=p["url"]))
			comment_limitation = _("Only the candidate's replies among the top comments of their recent public posts (no login).")
		comments: list[dict[str, Any]] = []
		for c in raw_comments:
			if len(comments) >= int(max_comments or 200):
				break
			pub = c.get("published_on")
			if pub and earliest_date:
				try:
					from frappe.utils import get_datetime
					if get_datetime(pub) < get_datetime(earliest_date):
						continue
				except Exception:
					pass
			c_copy = dict(c)
			c_copy["finding_type"] = "Comment"
			c_copy["provenance"] = provenance
			c_copy["account"] = getattr(account, "name", "") if hasattr(account, "name") else ""
			c_copy["platform"] = platform_name
			c_copy["is_reply"] = True
			comments.append(c_copy)

		return {
			"status": parsed.get("status", "Success"),
			"error": parsed.get("error"),
			"is_private": parsed.get("is_private", False),
			"profile_url": profile_url,
			"display_name": parsed.get("display_name", ""),
			"bio": parsed.get("bio", ""),
			"location": parsed.get("location", ""),
			"followers_count": parsed.get("followers_count"),
			"following_count": parsed.get("following_count"),
			"posts_count": parsed.get("posts_count") or len(posts),
			"mode_used": fetch_res.mode_used,
			"crawler_account": crawler_account_label if has_session else None,
			"provenance": provenance,
			"comment_limitation": comment_limitation,
			"posts": posts,
			"comments": comments,
		}

	def _crawl_via_api(
		self,
		platform: str,
		account: Any,
		profile_url: str,
		username: str,
		max_posts: int,
		max_comments: int,
		lookback_months: int,
		progress: Any = None,
	) -> dict[str, Any] | None:
		"""Crawl via the platform's web API with the crawler account session. Returns None to fall back to HTML."""
		from sentra_ats.bgc.crawler_session import (
			acquire_crawler_account_lock,
			check_and_update_crawler_rate_limits,
			enforce_crawler_delay,
			get_decrypted_storage_state,
			get_eligible_crawler_account_for_url,
			has_auth_cookies,
			mark_crawler_account_challenge,
			release_crawler_account_lock,
		)
		from sentra_ats.bgc.providers.social.api_base import (
			ApiUnavailable,
			ProfileNotFound,
			RateLimited,
			SessionRejected,
		)

		c_acc = get_eligible_crawler_account_for_url(profile_url)
		if not c_acc:
			return None
		state = get_decrypted_storage_state(c_acc["name"])
		if not has_auth_cookies(platform, state):
			return None
		cookies = {c["name"]: c["value"] for c in state.get("cookies", []) if c.get("name") and c.get("value")}
		label = c_acc.get("account_label") or c_acc["name"]
		account_name = getattr(account, "name", "") if hasattr(account, "name") else ""

		def report(template: str, *args: Any) -> None:
			if progress:
				progress(_(template).format(*args))

		base = {
			"profile_url": profile_url,
			"mode_used": "session-api",
			"crawler_account": label,
			"provenance": "Crawled (session)",
			"posts": [],
			"comments": [],
		}

		# One profile crawl counts as one unit against the crawler account's hourly/daily limits
		try:
			check_and_update_crawler_rate_limits(c_acc["name"])
		except Exception as e:
			return {**base, "status": "Failed", "error": str(e), "comment_limitation": str(e)}
		if not acquire_crawler_account_lock(c_acc["name"], timeout=900):
			return {**base, "status": "Failed", "error": _("Crawler account is busy with another check."), "comment_limitation": None}

		result: dict[str, Any] = {
			**base,
			"posts": [],
			"comments": [],
			"status": "Success",
			"error": None,
			"is_private": False,
			"display_name": "",
			"bio": "",
			"location": "",
			"followers_count": None,
			"following_count": None,
			"posts_count": None,
			"comment_limitation": None,
		}
		# lookback_months = 0 means no time limit (everything the account exposes)
		earliest = add_months(now_datetime(), -int(lookback_months)).timestamp() if lookback_months else None
		client = _make_api_client(platform, cookies, state)
		try:
			enforce_crawler_delay(c_acc["name"])
			client.crawl_profile(username, int(max_posts or 200), int(max_comments or 200), earliest, result, report)
		except ProfileNotFound:
			return {**base, "status": "Failed", "error": "not found", "comment_limitation": None}
		except SessionRejected as e:
			mark_crawler_account_challenge(c_acc["name"], f"{platform} session rejected: {e}")
			return None
		except (RateLimited, ApiUnavailable) as e:
			if platform == "Facebook" and isinstance(e, ApiUnavailable):
				client.doc_id = None
				_forget_facebook_doc_id()
			if not result.get("_profile_loaded"):
				if isinstance(e, ApiUnavailable):
					return None
				return {**base, "status": "Failed", "error": _("{0} rate limit: {1}").format(platform, e), "comment_limitation": None}
			note = (
				_("{0} rate limit reached, partial data: {1}") if isinstance(e, RateLimited)
				else _("{0} API stopped answering, partial data: {1}")
			).format(platform, e)
			result["comment_limitation"] = " ".join(x for x in (note, result.get("comment_limitation")) if x)
			result["_partial"] = True
		finally:
			release_crawler_account_lock(c_acc["name"])
		if getattr(client, "budget_hit", False):
			result["_partial"] = True
		if platform == "Facebook" and getattr(client, "doc_id", None):
			_remember_facebook_doc_id(client.doc_id)

		for p in result["posts"]:
			if not p.get("snippet"):
				p["snippet"] = _("(post without caption)")
			p.update(finding_type="Post", provenance="Crawled (session)", account=account_name, platform=platform)
		for c in result["comments"]:
			c.update(finding_type="Comment", provenance="Crawled (session)", account=account_name, platform=platform)
		for item in result["posts"] + result["comments"]:
			for k in [k for k in item if k.startswith("_") or k in ("pk", "comment_count", "author")]:
				item.pop(k)
		if result["comment_limitation"]:
			result["comment_limitation"] = _dedupe_sentences(_(result["comment_limitation"]))
		if result["posts_count"] is None:
			result["posts_count"] = len(result["posts"])
		result.pop("_profile_loaded", None)
		return result


API_PLATFORMS = ("Instagram", "TikTok", "Facebook", "LinkedIn", "Threads")


def _item_key(item: dict[str, Any]) -> str:
	"""Same post from the login and the public path: LinkedIn uses different URLs for it (/feed/update/urn:li:activity:N
	vs /posts/...-activity-N-xxxx), so its activity id is the key; the other platforms build identical URLs."""
	url = (item.get("url") or "").split("?")[0].rstrip("/").lower()
	m = re.search(r"activity[:-](\d+)", url)
	return m.group(1) if m else url


def merge_crawl_results(session: dict[str, Any], public: dict[str, Any], max_posts: int, max_comments: int) -> dict[str, Any]:
	"""Session result first (it is the fuller one), completed with public items it does not already have."""
	if public.get("status") == "Failed":
		return session
	merged = dict(session)
	for k in ("display_name", "bio", "location", "followers_count", "following_count", "is_private"):
		if merged.get(k) in (None, "") and public.get(k) not in (None, ""):
			merged[k] = public[k]
	post_keys = {_item_key(p) for p in session.get("posts", [])}
	merged["posts"] = (session.get("posts", []) + [p for p in public.get("posts", []) if _item_key(p) not in post_keys])[:max_posts]
	comment_keys = {(c.get("snippet") or "").strip().lower() for c in session.get("comments", [])}
	merged["comments"] = (
		session.get("comments", []) + [c for c in public.get("comments", []) if (c.get("snippet") or "").strip().lower() not in comment_keys]
	)[:max_comments]
	merged["status"] = "Success"
	merged["error"] = None
	merged["mode_used"] = f"{session.get('mode_used')}+{public.get('mode_used')}"
	merged["posts_count"] = max(session.get("posts_count") or 0, public.get("posts_count") or 0, len(merged["posts"])) or None
	notes = (session.get("error") if session.get("status") == "Failed" else None, session.get("comment_limitation"), public.get("comment_limitation"))
	merged["comment_limitation"] = _dedupe_sentences(" ".join(str(x) for x in notes if x)) or None
	return merged
FB_DOC_ID_CACHE_KEY = "bgc_facebook_timeline_doc_id"


def _dedupe_sentences(text: str | None) -> str | None:
	"""Collapse a message in which the same sentence is repeated (e.g. one error per retried request)."""
	if not text:
		return text
	seen: list[str] = []
	for part in re.split(r"(?<=[.!?])\s+", str(text).strip()):
		if part and part not in seen:
			seen.append(part)
	out = " ".join(seen)
	return out[:600] + ("…" if len(out) > 600 else "")


def _make_api_client(platform: str, cookies: dict[str, str], state: dict[str, Any] | None = None) -> Any:
	if platform == "Instagram":
		# Instagram rejects direct REST calls from servers with HTTP 429; a real browser session works
		from sentra_ats.bgc.providers.social.instagram_browser import InstagramBrowserClient

		return InstagramBrowserClient(state or {"cookies": [], "origins": []})
	if platform == "Threads":
		from sentra_ats.bgc.providers.social.threads_browser import ThreadsBrowserClient

		return ThreadsBrowserClient(state or {"cookies": [], "origins": []})
	if platform == "TikTok":
		from sentra_ats.bgc.providers.social.tiktok_api import TikTokApiClient

		return TikTokApiClient(cookies, pause=(0.8, 1.8))
	if platform == "Facebook":
		from sentra_ats.bgc.providers.social.facebook_browser import FacebookBrowserClient

		# Facebook's persisted-query ids rotate and hand-built GraphQL calls are refused; a browser works
		max_comment_posts = cint(frappe.db.get_single_value("Background Check Settings", "social_max_comment_posts")) or 40
		return FacebookBrowserClient(state or {"cookies": [], "origins": []}, max_comment_posts=max_comment_posts)
	if platform == "LinkedIn":
		from sentra_ats.bgc.providers.social.linkedin_api import LinkedInApiClient

		return LinkedInApiClient(cookies, pause=(1.2, 2.5))
	raise ValueError(platform)


def _remember_facebook_doc_id(doc_id: str) -> None:
	if not frappe.conf.get(FB_DOC_ID_CACHE_KEY):
		frappe.cache.set_value(FB_DOC_ID_CACHE_KEY, doc_id, expires_in_sec=86400)


def _forget_facebook_doc_id() -> None:
	frappe.cache.delete_value(FB_DOC_ID_CACHE_KEY)
