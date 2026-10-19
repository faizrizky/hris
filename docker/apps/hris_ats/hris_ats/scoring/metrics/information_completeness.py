# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metric 4: Information completeness (0-100)
Completeness weighting:
- Applicant name: 15
- Email: 20
- Phone number: 20
- Domicile / Location: 10
- Education section: 15
- Experience section: 15
- Skills section: 5
Total: 100 points.
"""

from __future__ import annotations

import json
import re
from typing import Any
from hris_ats.scoring.extract import ExtractionResult

DOMICILE_KEYWORDS = [
	"jakarta", "surabaya", "bandung", "medan", "semarang", "makassar",
	"palembang", "tangerang", "depok", "bekasi", "bogor", "yogyakarta",
	"malang", "surakarta", "solo", "pekanbaru", "denpasar", "bali",
	"indonesia", "domisili", "address", "alamat", "location", "tinggal",
	"residence", "city", "provinsi"
]


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	text = extraction.normalized_text
	header_text = sections.get("header", "") or text[:500]

	score = 0.0
	missing: list[str] = []
	template_parts: list[str] = []
	params: dict[str, Any] = {}

	# 1. Name (15)
	candidate_name = (criteria or {}).get("applicant_name", "")
	if candidate_name and candidate_name.lower() in text.lower():
		score += 15.0
	elif len(header_text.split("\n")[0].split()) >= 2:
		score += 15.0
	else:
		msg = "Applicant name not clearly detected"
		missing.append(msg)
		template_parts.append(msg)

	# 2. Email (20)
	has_email = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text))
	if has_email:
		score += 20.0
	else:
		msg = "Email not found"
		missing.append(msg)
		template_parts.append(msg)

	# 3. Phone (20)
	phone_pattern = r"(?:(?:\+62|62|0)8[1-9][\d\s\-]{6,12}\b|(?:\+62|62|0)(?:21|22|31|24|274)[\d\s\-]{6,10}\b|\+\d{1,3}[\s\-]?\d{3,5}[\s\-]?\d{4,8}\b)"
	has_phone = bool(re.search(phone_pattern, text))
	if has_phone:
		score += 20.0
	else:
		msg = "Phone number not found"
		missing.append(msg)
		template_parts.append(msg)

	# 4. Domicile / Location (10)
	has_domicile = any(k in text.lower() for k in DOMICILE_KEYWORDS)
	if has_domicile:
		score += 10.0
	else:
		msg = "Domicile/location not specified"
		missing.append(msg)
		template_parts.append(msg)

	# 5. Education section (15)
	if len(sections.get("education", "").strip()) > 10:
		score += 15.0
	else:
		msg = "Education section not found"
		missing.append(msg)
		template_parts.append(msg)

	# 6. Experience section (15)
	if len(sections.get("experience", "").strip()) > 10:
		score += 15.0
	else:
		msg = "Work experience section not found"
		missing.append(msg)
		template_parts.append(msg)

	# 7. Skills section (5)
	if len(sections.get("skills", "").strip()) > 5:
		score += 5.0
	else:
		msg = "Skills section not found"
		missing.append(msg)
		template_parts.append(msg)

	if not missing:
		final_reason = "Applicant information is complete (name, contact, domicile, education, experience, skills)."
		final_template = final_reason
	else:
		final_reason = "; ".join(missing) + "."
		final_template = "; ".join(template_parts) + "."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
		"reason_template": final_template,
		"reason_params": json.dumps(params) if params else "{}",
	}
