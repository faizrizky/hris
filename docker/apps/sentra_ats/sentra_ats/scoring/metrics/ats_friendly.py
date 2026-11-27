# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metric 1: ATS friendly (0-100)
Evaluates CV layout and parsing friendliness:
- Text extraction without errors
- At least 3 standard sections recognized
- Email and phone number readable
- Single-column layout preferred (multi-column penalized)
- Absence of complex/large tables
- Ideal page length (1-3 pages)
"""

from __future__ import annotations

import json
import re
from typing import Any

from sentra_ats.scoring.extract import ExtractionResult
from sentra_ats.scoring.sections import count_recognized_sections


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	if extraction.is_scan or extraction.error or not extraction.normalized_text.strip():
		err_msg = extraction.error or "CV text cannot be read or extracted by ATS parser."
		return {
			"score": 0.0,
			"applicable": True,
			"reason": err_msg,
			"reason_template": err_msg,
			"reason_params": "{}",
		}

	reasons: list[str] = []
	template_parts: list[str] = []
	params: dict[str, Any] = {}
	score = 100.0

	# 1. Standard section titles (>= 3)
	sec_count = count_recognized_sections(sections)
	if sec_count < 3:
		score -= 20.0
		msg = "Fewer than 3 standard section headings recognized"
		reasons.append(msg)
		template_parts.append(msg)

	# 2. Email and phone
	text = extraction.normalized_text
	has_email = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text))
	phone_pattern = r"(?:(?:\+62|62|0)8[1-9][\d\s\-]{6,12}\b|(?:\+62|62|0)(?:21|22|31|24|274)[\d\s\-]{6,10}\b|\+\d{1,3}[\s\-]?\d{3,5}[\s\-]?\d{4,8}\b)"
	has_phone = bool(re.search(phone_pattern, text))

	if not has_email and not has_phone:
		score -= 20.0
		msg = "Email and phone number not readable"
		reasons.append(msg)
		template_parts.append(msg)
	elif not has_email:
		score -= 10.0
		msg = "Email not found"
		reasons.append(msg)
		template_parts.append(msg)
	elif not has_phone:
		score -= 10.0
		msg = "Phone number not found"
		reasons.append(msg)
		template_parts.append(msg)

	# 3. Multi-column layout
	if extraction.is_multi_column:
		score -= 25.0
		msg = "Multi-column layout (two or more columns) complicates ATS reading order"
		reasons.append(msg)
		template_parts.append(msg)

	# 4. Tables
	if extraction.table_count > 2:
		score -= 15.0
		reasons.append(f"Found {extraction.table_count} tables that may fragment text in ATS parser")
		template_parts.append("Found {table_count} tables that may fragment text in ATS parser")
		params["table_count"] = extraction.table_count
	elif extraction.table_count > 0:
		score -= 5.0
		msg = "Data tables present"
		reasons.append(msg)
		template_parts.append(msg)

	# 5. Page count (1-3 pages ideal)
	if extraction.page_count > 3:
		score -= 15.0
		reasons.append(f"CV length exceeds recommendation ({extraction.page_count} pages, ideally 1-3 pages)")
		template_parts.append("CV length exceeds recommendation ({page_count} pages, ideally 1-3 pages)")
		params["page_count"] = extraction.page_count
	elif extraction.page_count == 0:
		score -= 20.0

	score = max(0.0, min(100.0, score))

	if not reasons:
		final_reason = "CV format is very ATS-friendly (clean layout, contacts and main sections complete)."
		final_template = final_reason
	else:
		final_reason = "; ".join(reasons) + "."
		final_template = "; ".join(template_parts) + "."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
		"reason_template": final_template,
		"reason_params": json.dumps(params) if params else "{}",
	}
