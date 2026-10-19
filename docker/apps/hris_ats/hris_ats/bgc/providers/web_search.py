# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Provider pencarian web untuk artikel berita dan dokumen publik.
Mati secara default sampai kredensial diisi di Background Check Settings.
"""

from __future__ import annotations

from typing import Any

from hris_ats.bgc.providers.base import BaseProvider, FindingData
from hris_ats.bgc.providers.mock import MockProvider


class WebSearchProvider(BaseProvider):
	name: str = "WebSearchProvider"

	def __init__(self, provider_type: str = "Mock", api_key: str | None = None):
		super().__init__(rate_limit_per_minute=20)
		self.provider_type = provider_type
		self.api_key = api_key
		self.mock_provider = MockProvider()

	def run(
		self,
		candidate_data: dict[str, Any],
		settings: dict[str, Any] | None = None,
	) -> list[FindingData]:
		# Jika menggunakan provider mock atau API key belum dikonfigurasi
		if self.provider_type == "Mock" or not self.api_key:
			return self.mock_provider.run(candidate_data, settings)

		# Integrasi live pencarian web (Brave / Google / SerpAPI)
		# Hanya berjalan jika API key valid
		return []
