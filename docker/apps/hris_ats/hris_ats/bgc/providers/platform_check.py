# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pengecekan akun profil publik pada platform media sosial/profesional.
Hanya memeriksa username dan URL profil publik yang dinyatakan kandidat/HR.
DILARANG memeriksa keterdaftaran akun melalui email atau nomor telepon (UU PDP & ToS).
Menggunakan bgc/fetch.py dan menolak scraping untuk domain Instagram, Facebook, TikTok, dan LinkedIn.
"""

from __future__ import annotations

from typing import Any
from hris_ats.bgc.fetch import FetchConfig, FetchResult, is_forbidden_domain
from hris_ats.bgc.providers.base import BaseProvider


class PlatformCheckProvider(BaseProvider):
	name: str = "PlatformCheckProvider"

	def __init__(
		self,
		config: FetchConfig | None = None,
		rate_limit_per_minute: int = 30,
	):
		super().__init__(config=config, rate_limit_per_minute=rate_limit_per_minute)

	def check_single_account(
		self,
		platform_name: str,
		username: str,
		url_template: str,
		check_method: str = "Status code",
		check_value: str = "200",
		is_mock: bool = False,
	) -> dict[str, Any]:
		"""Memeriksa keberadaan satu akun profil publik."""
		clean_user = username.strip().lstrip("@")
		profile_url = url_template.replace("{username}", clean_user) if url_template else ""

		post_access = "Manual review only"
		if platform_name in ("GitHub", "YouTube", "Reddit", "Mastodon"):
			post_access = "API"

		# Domain terlarang (Instagram, Facebook, TikTok, LinkedIn) tidak pernah diambil halamannya
		if is_forbidden_domain(profile_url) or platform_name in ("Instagram", "Facebook", "TikTok", "LinkedIn"):
			return {
				"exists": 1 if bool(clean_user) else 0,
				"profile_url": profile_url,
				"post_access": "Manual review only",
				"mode_used": "",
				"robots_ignored": False,
				"body": "",
				"page": None,
			}

		if is_mock or not profile_url:
			return {
				"exists": 1 if bool(clean_user) else 0,
				"profile_url": profile_url,
				"post_access": post_access,
				"mode_used": "mock",
				"robots_ignored": False,
				"body": "",
				"page": None,
			}

		method = "HEAD" if check_method == "Status code" else "GET"
		try:
			fetch_res = self.fetch(profile_url, method=method)
			status_code = fetch_res.status
			body = fetch_res.body or ""

			if check_method == "Status code":
				exists = 1 if str(status_code) == str(check_value or "200") else 0
			elif check_method == "Body contains":
				exists = 1 if (check_value and check_value in body) else 0
			elif check_method == "Body not contains":
				exists = 1 if (check_value and check_value not in body) else 0
			else:
				exists = 1 if status_code == 200 else 0

			return {
				"exists": exists,
				"profile_url": profile_url,
				"post_access": post_access,
				"mode_used": fetch_res.mode_used,
				"robots_ignored": fetch_res.robots_ignored,
				"body": body,
				"page": fetch_res.page,
			}

		except Exception:
			return {
				"exists": 0,
				"profile_url": profile_url,
				"post_access": post_access,
				"mode_used": "",
				"robots_ignored": False,
				"body": "",
				"page": None,
			}
