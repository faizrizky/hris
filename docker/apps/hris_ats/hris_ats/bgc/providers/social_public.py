# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _
from frappe.utils import add_months, now_datetime

from hris_ats.bgc import fetch as bgc_fetch
from hris_ats.bgc.consent import assert_social_consent
from hris_ats.bgc.fetch import FetchConfig, FetchResult, get_fetch_config_from_settings
from hris_ats.bgc.providers.base import BaseProvider
from hris_ats.bgc.providers.social import get_social_adapter


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
		lookback_months: int = 12,
		raw_fetch_fn: Any = None,
		progress: Any = None,
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

		# 2a. Instagram: post dan komentar hanya tersedia lewat API web dengan sesi login
		if platform_name == "Instagram" and raw_fetch_fn is None and getattr(cfg, "use_login_session", False):
			api_res = self._crawl_instagram_api(
				account, profile_url, clean_user, max_posts, max_comments, lookback_months, progress
			)
			if api_res is not None:
				return api_res

		# Cek apakah ada akun crawler untuk platform ini
		crawler_account_label = None
		if cfg.storage_state is None and getattr(cfg, "auto_escalate", False):
			from hris_ats.bgc.crawler_session import get_crawler_account_for_platform
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

		has_session = "+session" in fetch_res.mode_used or ">session" in fetch_res.mode_used
		provenance = "Crawled (session)" if has_session else "Crawled"

		posts: list[dict[str, Any]] = []
		raw_posts = parsed.get("posts", [])

		# 4. Filter tanggal postingan berdasarkan lookback_months dan batasi max_posts
		earliest_date = add_months(now_datetime(), -int(lookback_months or 12)) if hasattr(frappe, "utils") else None

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

	def _crawl_instagram_api(
		self,
		account: Any,
		profile_url: str,
		username: str,
		max_posts: int,
		max_comments: int,
		lookback_months: int,
		progress: Any = None,
	) -> dict[str, Any] | None:
		"""Crawl via Instagram's web API with the crawler account session. Returns None to fall back to HTML."""
		from hris_ats.bgc.crawler_session import (
			acquire_crawler_account_lock,
			check_and_update_crawler_rate_limits,
			enforce_crawler_delay,
			get_decrypted_storage_state,
			get_eligible_crawler_account_for_url,
			has_auth_cookies,
			mark_crawler_account_challenge,
			release_crawler_account_lock,
		)
		from hris_ats.bgc.providers.social.instagram_api import (
			InstagramApiClient,
			InstagramNotFound,
			InstagramRateLimited,
			InstagramSessionError,
		)

		c_acc = get_eligible_crawler_account_for_url(profile_url)
		if not c_acc:
			return None
		state = get_decrypted_storage_state(c_acc["name"])
		if not has_auth_cookies("Instagram", state):
			return None
		cookies = {c["name"]: c["value"] for c in state.get("cookies", []) if c.get("name") and c.get("value")}
		label = c_acc.get("account_label") or c_acc["name"]
		account_name = getattr(account, "name", "") if hasattr(account, "name") else ""

		def report(msg: str) -> None:
			if progress:
				progress(msg)

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

		try:
			enforce_crawler_delay(c_acc["name"])
			client = InstagramApiClient(cookies, pause=(0.6, 1.4))
			report(_("Instagram @{0}: reading profile").format(username))
			prof = client.profile(username)
			result = {
				**base,
				"status": "Success",
				"error": None,
				"is_private": prof["is_private"],
				"display_name": prof["display_name"],
				"bio": prof["bio"],
				"location": "",
				"followers_count": prof["followers_count"],
				"following_count": prof["following_count"],
				"posts_count": prof["posts_count"],
				"comment_limitation": None,
			}

			earliest = add_months(now_datetime(), -int(lookback_months or 12)).timestamp()
			posts: list[dict[str, Any]] = []
			comments: list[dict[str, Any]] = []
			try:
				for post in client.iter_posts(prof["id"], username, int(max_posts or 200), earliest):
					posts.append(post)
					if len(posts) % 12 == 0:
						report(_("Instagram @{0}: {1} posts read").format(username, len(posts)))

				remaining = int(max_comments or 200)
				with_comments = [p for p in posts if p.get("comment_count")]
				for i, post in enumerate(with_comments, 1):
					if remaining <= 0:
						break
					for c in client.iter_candidate_comments(post, username, remaining):
						comments.append(c)
						remaining -= 1
					if i % 10 == 0:
						report(
							_("Instagram @{0}: comments checked on {1}/{2} posts").format(username, i, len(with_comments))
						)
			except InstagramRateLimited as e:
				result["comment_limitation"] = _("Instagram rate limit reached, partial data: {0}").format(e)

			for p in posts:
				if not p.get("snippet"):
					p["snippet"] = _("(post without caption)")
				p.update(finding_type="Post", provenance="Crawled (session)", account=account_name, platform="Instagram")
				p.pop("pk", None)
			for c in comments:
				c.update(finding_type="Comment", provenance="Crawled (session)", account=account_name, platform="Instagram")
				c.pop("author", None)
			result["posts"] = posts
			result["comments"] = comments
			if prof["is_private"] and not posts:
				result["comment_limitation"] = _("Private profile: posts are only visible to approved followers.")
			return result
		except InstagramNotFound:
			return {**base, "status": "Failed", "error": "not found", "comment_limitation": None}
		except InstagramSessionError as e:
			mark_crawler_account_challenge(c_acc["name"], f"Instagram session rejected: {e}")
			return None
		except InstagramRateLimited as e:
			return {**base, "status": "Failed", "error": _("Instagram rate limit: {0}").format(e), "comment_limitation": None}
		finally:
			release_crawler_account_lock(c_acc["name"])
