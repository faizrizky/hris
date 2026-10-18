# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Antarmuka dasar (Base Provider) untuk pengumpulan data Background Check.
Menyediakan rate limiting, User-Agent resmi, dan caching hasil query 24 jam.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class FindingData:
	finding_type: str  # Article, File, Case, Post
	title: str
	snippet: str = ""
	url: str = ""
	source_name: str = ""
	published_on: str | None = None
	file_type: str = ""
	match_confidence: int = 100
	match_reasons: str = ""
	category: str = "Netral"  # Prestasi, Profesional, Netral, Berisiko
	risk_flags: str = ""
	severity: str = "Info"  # Info, Rendah, Sedang, Tinggi
	case_type: str = ""
	case_number: str = ""
	court: str = ""
	party_role: str = ""
	registered_on: str | None = None
	uploaded_on: str | None = None
	adjudicated_on: str | None = None
	account: str = ""
	hr_verdict: str = "Belum ditinjau"

	def as_dict(self) -> dict[str, Any]:
		return {k: v for k, v in self.__dict__.items() if v is not None}


class BaseProvider:
	name: str = "BaseProvider"

	def __init__(self, rate_limit_per_minute: int = 10, user_agent: str | None = None):
		self.rate_limit_per_minute = max(1, rate_limit_per_minute)
		self.min_interval = 60.0 / self.rate_limit_per_minute
		self.last_call_time: float = 0.0
		self.user_agent = user_agent or "HRIS-ATS-Verifier/1.0 (+https://example.com; hr@example.com)"
		self._cache: dict[str, tuple[float, list[FindingData]]] = {}

	def _wait_for_rate_limit(self) -> None:
		now = time.time()
		elapsed = now - self.last_call_time
		if elapsed < self.min_interval:
			time.sleep(self.min_interval - elapsed)
		self.last_call_time = time.time()

	def get_from_cache(self, key: str, ttl_seconds: int = 86400) -> list[FindingData] | None:
		if key in self._cache:
			timestamp, data = self._cache[key]
			if time.time() - timestamp < ttl_seconds:
				return data
			del self._cache[key]
		return None

	def set_to_cache(self, key: str, data: list[FindingData]) -> None:
		self._cache[key] = (time.time(), data)

	def run(self, candidate_data: dict[str, Any], settings: dict[str, Any] | None = None) -> list[FindingData]:
		raise NotImplementedError("Subclasses must implement run()")
