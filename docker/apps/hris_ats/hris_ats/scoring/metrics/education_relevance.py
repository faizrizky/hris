# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 5: Education relevance (0-100)
Mencocokkan jenjang dan jurusan pendidikan dengan syarat lowongan:
- Jenjang pendidikan >= min_education = 60 poin (kurang jenjang = penalti proporsional)
- Jurusan cocok dengan education_majors (rapidfuzz partial_ratio >= 85) = 40 poin
- Bila lowongan tidak menentukan jenjang pendidikan, metrik berstatus tidak berlaku (applicable = False).
"""

from __future__ import annotations

import re
from typing import Any
from rapidfuzz import fuzz
from hris_ats.scoring.extract import ExtractionResult

DEGREE_LEVELS = {
	"sma": 1, "smk": 1, "high school": 1, "sma/smk": 1,
	"d1": 2, "d2": 2, "d3": 2, "diploma": 2,
	"d4": 3, "s1": 3, "d4/s1": 3, "sarjana": 3, "bachelor": 3, "undergraduate": 3,
	"s2": 4, "master": 4, "magister": 4, "postgraduate": 4,
	"s3": 5, "phd": 5, "doktor": 5, "doctorate": 5,
}

DEGREE_NAMES = {
	1: "SMA/SMK",
	2: "D3",
	3: "D4/S1",
	4: "S2",
	5: "S3",
}


def parse_degree_level(degree_str: str) -> int:
	clean = degree_str.strip().lower()
	return DEGREE_LEVELS.get(clean, 0)


def detect_candidate_degree(text: str) -> tuple[int, str]:
	"""Mendeteksi jenjang pendidikan tertinggi kandidat dari teks."""
	highest_level = 0
	found_name = "Tidak terdeteksi"

	lower = text.lower()
	# Urutan pengecekan dari jenjang tertinggi ke terendah
	patterns = [
		(5, r"\b(?:s3|ph\.?d|doktor|doctorate)\b", "S3/Doktor"),
		(4, r"\b(?:s2|master|magister|m\.s|m\.sc|m\.kom|m\.m)\b", "S2/Master"),
		(3, r"\b(?:s1|d4|sarjana|bachelor|b\.s|b\.sc|s\.kom|s\.t|s\.e|s\.si)\b", "D4/S1/Sarjana"),
		(2, r"\b(?:d3|diploma|ahli madya|a\.md)\b", "D3/Diploma"),
		(1, r"\b(?:sma|smk|ma|slta)\b", "SMA/SMK"),
	]

	for level, pat, name in patterns:
		if re.search(pat, lower):
			if level > highest_level:
				highest_level = level
				found_name = name

	return highest_level, found_name


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	crit = criteria or {}
	min_edu = crit.get("min_education")
	majors_req = crit.get("education_majors")

	if not min_edu and not majors_req:
		return {
			"score": 100.0,
			"applicable": False,
			"reason": "Lowongan tidak menentukan kriteria pendidikan minimal atau jurusan.",
		}

	edu_text = sections.get("education", "") or extraction.normalized_text
	cand_level, cand_degree_name = detect_candidate_degree(edu_text)

	score = 0.0
	reasons: list[str] = []

	# 1. Poin Jenjang Pendidikan (maksimal 60 poin)
	target_level = parse_degree_level(min_edu) if min_edu else 0

	if target_level > 0:
		if cand_level >= target_level:
			score += 60.0
			reasons.append(f"Jenjang {cand_degree_name} memenuhi minimal {DEGREE_NAMES.get(target_level, min_edu)}")
		elif cand_level > 0:
			gap = target_level - cand_level
			earned = max(10.0, 60.0 - (gap * 25.0))
			score += earned
			reasons.append(f"Jenjang {cand_degree_name}, lowongan meminta {DEGREE_NAMES.get(target_level, min_edu)}")
		else:
			reasons.append(f"Jenjang pendidikan tidak terdeteksi (lowongan minta {DEGREE_NAMES.get(target_level, min_edu)})")
	else:
		# Jika tidak ada target jenjang, beri 60 jika terdeteksi jenjang apa pun
		score += 60.0 if cand_level > 0 else 30.0

	# 2. Poin Jurusan (maksimal 40 poin)
	if majors_req:
		target_majors = [m.strip().lower() for m in re.split(r"[,;\n]+", majors_req) if m.strip()]
		matched_majors = []
		for tm in target_majors:
			match_score = fuzz.partial_ratio(tm, edu_text.lower())
			if match_score >= 85:
				matched_majors.append(tm)

		if matched_majors:
			score += 40.0
			reasons.append(f"Jurusan cocok: {', '.join(matched_majors)}")
		else:
			reasons.append(f"Jurusan tidak cocok dengan kriteria ({', '.join(target_majors[:2])})")
	else:
		# Jika lowongan tidak mensyaratkan jurusan tertentu, otomatis dapat 40 jika jenjang terpenuhi
		score += 40.0 if cand_level >= target_level else 20.0

	final_score = max(0.0, min(100.0, score))
	final_reason = "; ".join(reasons) + "."

	return {
		"score": round(final_score, 1),
		"applicable": True,
		"reason": final_reason,
	}
