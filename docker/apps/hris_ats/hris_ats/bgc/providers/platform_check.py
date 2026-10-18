# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pengecekan akun profil publik pada platform media sosial/profesional.
Hanya memeriksa username dan URL profil publik yang dinyatakan kandidat/HR.
DILARANG memeriksa keterdaftaran akun melalui email atau nomor telepon (UU PDP & ToS).
"""

from __future__ import annotations

import urllib.request
import urllib.error
from typing import Any
from hris_ats.bgc.providers.base import BaseProvider


class PlatformCheckProvider(BaseProvider):
	name: str = "PlatformCheckProvider"

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

		if is_mock or not profile_url:
			# Lingkungan mock/offline: akun dianggap ada jika username valid
			return {
				"exists": 1 if bool(clean_user) else 0,
				"profile_url": profile_url,
				"post_access": "API" if platform_name in ("GitHub", "YouTube", "Reddit", "Mastodon") else "Manual review only",
			}

		self._wait_for_rate_limit()

		try:
			req = urllib.request.Request(
				profile_url,
				headers={"User-Agent": self.user_agent},
				method="HEAD" if check_method == "Status code" else "GET",
			)
			with urllib.request.urlopen(req, timeout=5) as response:
				status_code = response.getcode()
				if check_method == "Status code":
					exists = 1 if str(status_code) == str(check_value or "200") else 0
				elif check_method == "Body contains":
					body = response.read(10000).decode("utf-8", errors="ignore")
					exists = 1 if (check_value and check_value in body) else 0
				elif check_method == "Body not contains":
					body = response.read(10000).decode("utf-8", errors="ignore")
					exists = 1 if (check_value and check_value not in body) else 0
				else:
					exists = 1 if status_code == 200 else 0
		except urllib.error.HTTPError as e:
			exists = 1 if check_method == "Status code" and str(e.code) == str(check_value) else 0
		except Exception:
			exists = 0

		post_access = "Manual review only"
		if platform_name in ("GitHub", "YouTube", "Reddit", "Mastodon"):
			post_access = "API"

		return {
			"exists": exists,
			"profile_url": profile_url,
			"post_access": post_access,
		}
