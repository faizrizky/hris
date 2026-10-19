# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metric 9: Certification relevance (0-100)
Matches candidate certifications against criteria:
- Matches certification_keywords in certifications section or full text
- If no certification criteria specified, applicable = False.
"""

from __future__ import annotations

import json
import re
from typing import Any
from rapidfuzz import fuzz
from hris_ats.scoring.extract import ExtractionResult


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	crit = criteria or {}
	keywords_raw = crit.get("certification_keywords") or ""

	keywords = [k.strip() for k in re.split(r"[\n,;]+", keywords_raw) if k.strip()]

	if not keywords:
		msg = "Job opening does not require specific certifications."
		return {
			"score": 100.0,
			"applicable": False,
			"reason": msg,
			"reason_template": msg,
			"reason_params": "{}",
		}

	cert_text = sections.get("certifications", "")
	full_text = extraction.normalized_text

	matched: list[str] = []
	missing: list[str] = []

	for kw in keywords:
		kw_clean = kw.lower()
		found = False

		if re.search(r"(?:^|[^a-zA-Z0-9])" + re.escape(kw_clean) + r"(?:$|[^a-zA-Z0-9])", full_text.lower()):
			found = True
		elif cert_text and fuzz.partial_ratio(kw_clean, cert_text.lower()) >= 85:
			found = True

		if found:
			matched.append(kw)
		else:
			missing.append(kw)

	score = (len(matched) / len(keywords)) * 100.0 if keywords else 100.0
	score = max(0.0, min(100.0, score))

	reasons: list[str] = []
	template_parts: list[str] = []
	params: dict[str, Any] = {}

	if matched:
		matched_str = ", ".join(matched)
		reasons.append(f"Certifications matched: {matched_str}")
		template_parts.append("Certifications matched: {certs}")
		params["certs"] = matched_str

	if missing:
		missing_str = ", ".join(missing[:2])
		reasons.append(f"Missing: {missing_str}")
		template_parts.append("Missing: {missing}")
		params["missing"] = missing_str

	final_reason = "; ".join(reasons) + "."
	final_template = "; ".join(template_parts) + "."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
		"reason_template": final_template,
		"reason_params": json.dumps(params) if params else "{}",
	}
