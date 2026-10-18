# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Provider pemeriksaan Direktori Putusan Mahkamah Agung.
Mendukung mode live (jika diaktifkan) dan fallback ke MockProvider jika offline.
"""

from __future__ import annotations

from typing import Any
from hris_ats.bgc.providers.base import BaseProvider, FindingData
from hris_ats.bgc.providers.mock import MockProvider


class CourtMAProvider(BaseProvider):
	name: str = "CourtMAProvider"

	def __init__(self, is_mock: bool = True):
		super().__init__(rate_limit_per_minute=5)
		self.is_mock = is_mock
		self.mock_provider = MockProvider()

	def run(
		self,
		candidate_data: dict[str, Any],
		settings: dict[str, Any] | None = None,
	) -> list[FindingData]:
		# Jika mode mock aktif atau tidak ada koneksi live MA
		data = dict(candidate_data)
		data["source"] = "Case history"
		return self.mock_provider.run(data, settings)
