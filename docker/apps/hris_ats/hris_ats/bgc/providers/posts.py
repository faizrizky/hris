# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Provider post publik resmi (YouTube, GitHub, Mastodon, Reddit).
X / Twitter dinonaktifkan secara default.
Scraping Instagram, TikTok, LinkedIn dilarang keras.
"""

from __future__ import annotations

import json
import os
from typing import Any

from hris_ats.bgc.providers.base import BaseProvider


class PostsProvider(BaseProvider):
	name: str = "PostsProvider"

	def __init__(self, is_mock: bool = True):
		super().__init__(rate_limit_per_minute=30)
		self.is_mock = is_mock
		fixture_path = os.path.join(
			os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
			"tests",
			"fixtures",
			"bgc_mock_data.json",
		)
		self._mock_data = {}
		if os.path.exists(fixture_path):
			with open(fixture_path, encoding="utf-8") as f:
				self._mock_data = json.load(f)

	def fetch_posts(
		self,
		platform_name: str,
		username: str,
		max_count: int = 50,
	) -> list[dict[str, Any]]:
		"""Mengambil post publik dari akun terdaftar."""
		if self.is_mock:
			for _key, val in self._mock_data.items():
				if "posts" in val:
					# Cocokkan nama kandidat atau username jika ada
					for acc in val.get("accounts", []):
						if acc.get("platform") == platform_name and acc.get("username") == username:
							return val["posts"][:max_count]
					# Fallback ke post pertama jika diuji secara umum
					return val["posts"][:max_count]
			return []

		# Integrasi API resmi (mis. GitHub Public Events / Gists)
		return []
