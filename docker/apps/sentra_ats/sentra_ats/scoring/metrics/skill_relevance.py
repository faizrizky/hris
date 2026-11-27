# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metric 6: Skill relevance (0-100)
Matches candidate skills against job requirements:
- Required skills (weight 2)
- Preferred skills (weight 1)
- Matching using rapidfuzz token_set_ratio >= 85 or exact word boundary
- If no skill criteria specified, applicable = False.
"""

from __future__ import annotations

import json
import re
from typing import Any

from rapidfuzz import fuzz

from sentra_ats.scoring.extract import ExtractionResult


def _match_skill(skill: str, target_text: str) -> bool:
	skill_clean = skill.strip().lower()
	if not skill_clean:
		return False

	target_clean = target_text.lower()
	escaped = re.escape(skill_clean)
	if re.search(r"(?:^|[^a-zA-Z0-9_#+])" + escaped + r"(?:$|[^a-zA-Z0-9_#+])", target_clean):
		return True

	for line in target_clean.split("\n"):
		if len(line.strip()) < 2:
			continue
		if fuzz.token_set_ratio(skill_clean, line) >= 85:
			return True

	return False


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	crit = criteria or {}
	req_raw = crit.get("required_skills") or ""
	pref_raw = crit.get("preferred_skills") or ""

	req_list = [s.strip() for s in re.split(r"[\n,;]+", req_raw) if s.strip()]
	pref_list = [s.strip() for s in re.split(r"[\n,;]+", pref_raw) if s.strip()]

	if not req_list and not pref_list:
		msg = "No required or preferred skill criteria specified for the job opening."
		return {
			"score": 100.0,
			"applicable": False,
			"reason": msg,
			"reason_template": msg,
			"reason_params": "{}",
		}

	search_text = (
		sections.get("skills", "") + "\n" +
		sections.get("experience", "") + "\n" +
		extraction.normalized_text
	)

	matched_req: list[str] = []
	missing_req: list[str] = []
	for skill in req_list:
		if _match_skill(skill, search_text):
			matched_req.append(skill)
		else:
			missing_req.append(skill)

	matched_pref: list[str] = []
	missing_pref: list[str] = []
	for skill in pref_list:
		if _match_skill(skill, search_text):
			matched_pref.append(skill)
		else:
			missing_pref.append(skill)

	total_points = (len(req_list) * 2) + (len(pref_list) * 1)
	earned_points = (len(matched_req) * 2) + (len(matched_pref) * 1)

	score = (earned_points / total_points) * 100.0 if total_points > 0 else 100.0
	score = max(0.0, min(100.0, score))

	reasons: list[str] = []
	template_parts: list[str] = []
	params: dict[str, Any] = {}

	if req_list:
		reasons.append(f"Matched {len(matched_req)} of {len(req_list)} required skills")
		template_parts.append("Matched {matched_req_count} of {total_req_count} required skills")
		params["matched_req_count"] = len(matched_req)
		params["total_req_count"] = len(req_list)

		if missing_req:
			missing_str = ", ".join(missing_req[:3])
			reasons.append(f"missing: {missing_str}")
			template_parts.append("missing: {missing_skills}")
			params["missing_skills"] = missing_str

	if pref_list:
		reasons.append(f"Matched {len(matched_pref)} of {len(pref_list)} preferred skills")
		template_parts.append("Matched {matched_pref_count} of {total_pref_count} preferred skills")
		params["matched_pref_count"] = len(matched_pref)
		params["total_pref_count"] = len(pref_list)

	final_reason = "; ".join(reasons) + "."
	final_template = "; ".join(template_parts) + "."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
		"reason_template": final_template,
		"reason_params": json.dumps(params) if params else "{}",
	}
