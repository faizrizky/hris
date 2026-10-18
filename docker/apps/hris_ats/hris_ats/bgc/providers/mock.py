# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Provider Mock untuk pengujian dan lingkungan offline tanpa akses internet luar."""

from __future__ import annotations

import json
import os
from typing import Any

from hris_ats.bgc.providers.base import BaseProvider, FindingData
from hris_ats.bgc.analysis.identity import calculate_match_confidence
from hris_ats.bgc.analysis.classify import classify_text
from hris_ats.bgc.analysis.case import evaluate_case_severity


class MockProvider(BaseProvider):
	name: str = "MockProvider"

	def __init__(self, fixture_path: str | None = None):
		super().__init__(rate_limit_per_minute=100)
		if not fixture_path:
			fixture_path = os.path.join(
				os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
				"tests",
				"fixtures",
				"bgc_mock_data.json",
			)
		self.fixture_path = fixture_path
		self._mock_data: dict[str, Any] = {}
		self._load_fixtures()

	def _load_fixtures(self) -> None:
		if os.path.exists(self.fixture_path):
			with open(self.fixture_path, "r", encoding="utf-8") as f:
				self._mock_data = json.load(f)

	def run(
		self,
		candidate_data: dict[str, Any],
		settings: dict[str, Any] | None = None,
	) -> list[FindingData]:
		name = candidate_data.get("full_name", "")
		context_terms = candidate_data.get("context_terms", [])
		if isinstance(context_terms, str):
			context_terms = [t.strip() for t in context_terms.split(",") if t.strip()]

		name_variants = candidate_data.get("name_variants", [])
		if isinstance(name_variants, str):
			name_variants = [v.strip() for v in name_variants.split("\n") if v.strip()]

		source_filter = candidate_data.get("source")  # None means all, or Article, File, etc.
		lexicon_items = candidate_data.get("lexicon_items", [])

		findings: list[FindingData] = []

		# Cari data kandidat di mock data (persis atau kemiripan nama)
		entry = self._mock_data.get(name)
		if not entry:
			for key, val in self._mock_data.items():
				if key.lower() in name.lower() or name.lower() in key.lower():
					entry = val
					break

		if not entry:
			return []

		# 1. Articles
		if source_filter in (None, "Article") and "articles" in entry:
			for art in entry["articles"]:
				text = f"{art['title']} {art['snippet']}"
				conf, reasons = calculate_match_confidence(
					name, name_variants, context_terms, text, total_hits=10
				)
				cls_res = classify_text(art["title"], art["snippet"], lexicon_items, conf)
				sev = art.get("severity") or cls_res["severity"]
				cat = art.get("category") or cls_res["category"]
				findings.append(FindingData(
					finding_type="Article",
					title=art["title"],
					snippet=art["snippet"],
					url=art.get("url", ""),
					source_name=art.get("source_name", "Media"),
					published_on=art.get("published_on"),
					match_confidence=conf,
					match_reasons="; ".join(reasons),
					category=cat,
					severity=sev,
				))

		# 2. Files
		if source_filter in (None, "File") and "files" in entry:
			for f in entry["files"]:
				text = f"{f['title']} {f['snippet']}"
				conf, reasons = calculate_match_confidence(
					name, name_variants, context_terms, text, total_hits=10
				)
				cls_res = classify_text(f["title"], f["snippet"], lexicon_items, conf)
				sev = f.get("severity") or cls_res["severity"]
				cat = f.get("category") or cls_res["category"]
				findings.append(FindingData(
					finding_type="File",
					title=f["title"],
					snippet=f["snippet"],
					url=f.get("url", ""),
					source_name=f.get("source_name", "File Publik"),
					file_type=f.get("file_type", "PDF"),
					published_on=f.get("published_on"),
					match_confidence=conf,
					match_reasons="; ".join(reasons),
					category=cat,
					severity=sev,
				))

		# 3. Cases
		if source_filter in (None, "Case history", "Case") and "cases" in entry:
			for c in entry["cases"]:
				text = f"{c['title']} {c['snippet']}"
				conf, reasons = calculate_match_confidence(
					name, name_variants, context_terms, text, total_hits=10
				)
				case_eval = evaluate_case_severity(c.get("case_type", ""), c.get("party_role", ""))
				findings.append(FindingData(
					finding_type="Case",
					title=c["title"],
					snippet=c["snippet"],
					url=c.get("url", ""),
					source_name="Direktori Putusan MA",
					case_type=c.get("case_type", ""),
					case_number=c.get("case_number", ""),
					court=c.get("court", ""),
					party_role=c.get("party_role", ""),
					registered_on=c.get("registered_on"),
					uploaded_on=c.get("uploaded_on"),
					adjudicated_on=c.get("adjudicated_on"),
					match_confidence=conf,
					match_reasons="; ".join(reasons),
					category=c.get("category", case_eval["category"]),
					severity=c.get("severity", case_eval["severity"]),
				))

		return findings
