# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Antarmuka dasar (Base Provider) untuk pengumpulan data Background Check.
Mendelegasikan pengambilan halaman, robots.txt, batas laju per domain, dan caching ke bgc/fetch.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from hris_ats.bgc.fetch import FetchConfig, FetchResult, fetch, get_fetch_config_from_settings


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
	detail_url: str = ""
	pdf_url: str = ""
	text_source: str = "Cuplikan"
	evidence_excerpt: str = ""

	def as_dict(self) -> dict[str, Any]:
		return {k: v for k, v in self.__dict__.items() if v is not None}


class BaseProvider:
	name: str = "BaseProvider"

	def __init__(
		self,
		config: FetchConfig | None = None,
		rate_limit_per_minute: int | None = None,
		user_agent: str | None = None,
	):
		self.config = config or get_fetch_config_from_settings()
		if rate_limit_per_minute is not None:
			self.config.rate_limit_per_minute = rate_limit_per_minute
		if user_agent is not None:
			self.config.user_agent = user_agent

	@property
	def rate_limit_per_minute(self) -> int:
		return self.config.rate_limit_per_minute

	@property
	def user_agent(self) -> str:
		return self.config.user_agent

	def fetch(self, url: str, *, method: str = "GET", **kwargs) -> FetchResult:
		"""Mengambil halaman web menggunakan lapisan terpusat bgc/fetch.py."""
		return fetch(url, config=self.config, method=method, **kwargs)

	def run(self, candidate_data: dict[str, Any], settings: dict[str, Any] | None = None) -> list[FindingData]:
		raise NotImplementedError("Subclasses must implement run()")
