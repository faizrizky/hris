# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 6: Skill relevance (0-100)
Mencocokkan keahlian kandidat dengan kriteria lowongan:
- Keahlian wajib (required_skills, bobot 2)
- Keahlian tambahan (preferred_skills, bobot 1)
- Pencocokan dengan rapidfuzz token_set_ratio >= 85 atau substring eksak
- Bila tidak ada kriteria keahlian di lowongan, metrik berstatus tidak berlaku (applicable = False).
"""

from __future__ import annotations

import re
from typing import Any
from rapidfuzz import fuzz
from hris_ats.scoring.extract import ExtractionResult


def _match_skill(skill: str, target_text: str) -> bool:
	skill_clean = skill.strip().lower()
	if not skill_clean:
		return False

	target_clean = target_text.lower()
	# 1. Exact regex word match (mis. 'SQL', 'Python', 'Go')
	escaped = re.escape(skill_clean)
	if re.search(r"(?:^|[^a-zA-Z0-9_#+])" + escaped + r"(?:$|[^a-zA-Z0-9_#+])", target_clean):
		return True

	# 2. Rapidfuzz token_set_ratio pada kalimat/baris
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
		return {
			"score": 100.0,
			"applicable": False,
			"reason": "Tidak ada kriteria keahlian wajib atau tambahan yang ditentukan di lowongan.",
		}

	# Cari di seluruh teks CV (dengan prioritas bagian skills dan experience)
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
	if req_list:
		reasons.append(f"Cocok {len(matched_req)} dari {len(req_list)} skill wajib")
		if missing_req:
			reasons.append(f"belum ada: {', '.join(missing_req[:3])}")
	if pref_list:
		reasons.append(f"Cocok {len(matched_pref)} dari {len(pref_list)} skill tambahan")

	final_reason = "; ".join(reasons) + "."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
	}
