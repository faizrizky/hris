# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 9: Certification relevance (0-100)
Mencocokkan sertifikasi kandidat dengan kriteria lowongan:
- Pencocokan certification_keywords ke bagian sertifikat atau seluruh teks CV
- Bila lowongan tidak mensyaratkan sertifikasi, metrik berstatus tidak berlaku (applicable = False).
"""

from __future__ import annotations

import re
from typing import Any
from rapidfuzz import fuzz
from hris_ats.scoring.extract import ExtractionResult


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	crit = criteria or {}
	keywords_raw = crit.get("certification_keywords") or ""

	keywords = [k.strip() for k in re.split(r"[\n,;]+", keywords_raw) if k.strip()]

	if not keywords:
		return {
			"score": 100.0,
			"applicable": False,
			"reason": "Lowongan tidak mensyaratkan sertifikasi tertentu.",
		}

	cert_text = sections.get("certifications", "")
	full_text = extraction.normalized_text

	matched: list[str] = []
	missing: list[str] = []

	for kw in keywords:
		kw_clean = kw.lower()
		found = False

		# 1. Exact regex boundary match
		if re.search(r"(?:^|[^a-zA-Z0-9])" + re.escape(kw_clean) + r"(?:$|[^a-zA-Z0-9])", full_text.lower()):
			found = True
		# 2. Rapidfuzz partial ratio di bagian sertifikasi
		elif cert_text and fuzz.partial_ratio(kw_clean, cert_text.lower()) >= 85:
			found = True

		if found:
			matched.append(kw)
		else:
			missing.append(kw)

	score = (len(matched) / len(keywords)) * 100.0 if keywords else 100.0
	score = max(0.0, min(100.0, score))

	reasons: list[str] = []
	if matched:
		reasons.append(f"Sertifikasi cocok: {', '.join(matched)}")
	if missing:
		reasons.append(f"Belum memiliki: {', '.join(missing[:2])}")

	final_reason = "; ".join(reasons) + "."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
	}
