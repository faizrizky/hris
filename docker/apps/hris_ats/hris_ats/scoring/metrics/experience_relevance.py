# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 7: Experience relevance (0-100)
Mengevaluasi kesesuaian pengalaman kerja:
- Menghitung total durasi pengalaman dengan menggabungkan rentang tanggal yang tumpang tindih (union)
- 70 poin = min(total_tahun / min_years_experience, 1.0) * 70
- 30 poin = kecocokan judul jabatan dengan relevant_titles (rapidfuzz token_set_ratio >= 85)
- Bila lowongan tidak menentukan min_years_experience dan relevant_titles, metrik berstatus tidak berlaku (applicable = False).
"""

from __future__ import annotations

import re
from typing import Any
from rapidfuzz import fuzz
from hris_ats.scoring.extract import ExtractionResult
from hris_ats.scoring.metrics.date_consistency import extract_date_ranges


def calculate_total_experience_years(ranges: list[dict[str, Any]]) -> float:
	"""Menggabungkan rentang tanggal kerja (union) agar tumpang tindih dihitung sekali."""
	if not ranges:
		return 0.0

	# Konversi ke bulan absolut: year * 12 + month
	intervals: list[tuple[int, int]] = []
	for r in ranges:
		sy, sm = r["start"]
		ey, em = r["end"]
		start_m = sy * 12 + sm
		end_m = ey * 12 + em
		if start_m <= end_m:
			intervals.append((start_m, end_m))

	if not intervals:
		return 0.0

	intervals.sort(key=lambda x: x[0])
	merged: list[tuple[int, int]] = [intervals[0]]

	for current in intervals[1:]:
		prev_start, prev_end = merged[-1]
		if current[0] <= prev_end:
			merged[-1] = (prev_start, max(prev_end, current[1]))
		else:
			merged.append(current)

	total_months = sum((end - start + 1) for start, end in merged)
	return round(total_months / 12.0, 1)


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	crit = criteria or {}
	min_years = float(crit.get("min_years_experience") or 0.0)
	relevant_titles_raw = crit.get("relevant_titles") or ""

	titles_list = [t.strip() for t in re.split(r"[\n,;]+", relevant_titles_raw) if t.strip()]

	if min_years <= 0.0 and not titles_list:
		return {
			"score": 100.0,
			"applicable": False,
			"reason": "Lowongan tidak menentukan syarat minimal tahun pengalaman atau judul jabatan relevan.",
			"total_years": 0.0,
		}

	exp_text = sections.get("experience", "") or extraction.normalized_text
	ranges = extract_date_ranges(exp_text)
	total_years = calculate_total_experience_years(ranges)

	score = 0.0
	reasons: list[str] = []

	# 1. Poin durasi pengalaman (maksimal 70 poin)
	if min_years > 0.0:
		ratio = min(1.0, total_years / min_years)
		duration_points = ratio * 70.0
		score += duration_points
		if total_years >= min_years:
			reasons.append(f"Pengalaman {total_years} tahun memenuhi syarat minimal {min_years} tahun")
		else:
			reasons.append(f"Pengalaman {total_years} tahun dari minimal {min_years} tahun")
	else:
		# Jika lowongan tidak menentukan durasi minimal, berikan 70 jika ada pengalaman
		score += 70.0 if total_years > 0 else 35.0
		reasons.append(f"Total pengalaman terdeteksi: {total_years} tahun")

	# 2. Poin judul jabatan relevan (maksimal 30 poin)
	if titles_list:
		matched_titles: list[str] = []
		for title in titles_list:
			title_clean = title.lower()
			# Cari kecocokan di bagian pengalaman atau teks CV
			for line in exp_text.split("\n"):
				if fuzz.token_set_ratio(title_clean, line.lower()) >= 85:
					matched_titles.append(title)
					break

		if matched_titles:
			score += 30.0
			reasons.append(f"Judul jabatan relevan cocok: {', '.join(set(matched_titles))}")
		else:
			reasons.append(f"Belum ditemukan judul jabatan relevan ({', '.join(titles_list[:2])})")
	else:
		# Jika lowongan tidak mensyaratkan judul tertentu, berikan 30 jika ada pengalaman
		score += 30.0 if total_years > 0 else 15.0

	final_score = max(0.0, min(100.0, score))
	final_reason = "; ".join(reasons) + "."

	return {
		"score": round(final_score, 1),
		"applicable": True,
		"reason": final_reason,
		"total_years": total_years,
	}
