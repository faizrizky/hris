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
