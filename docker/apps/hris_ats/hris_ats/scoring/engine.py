# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Engine evaluasi skrining CV utama (murni, tanpa import frappe).
Menggabungkan ekstraksi teks, segmentasi bagian, evaluasi 9 metrik, dan kalkulasi skor total.
"""

from __future__ import annotations

from typing import Any
from hris_ats.scoring.extract import extract_cv, ExtractionResult
from hris_ats.scoring.sections import split_sections
from hris_ats.scoring.total import calculate_total_score

# 9 modul metrik
from hris_ats.scoring.metrics import (
	ats_friendly,
	grammar,
	date_consistency,
	information_completeness,
	education_relevance,
	skill_relevance,
	experience_relevance,
	achievement_relevance,
	certification_relevance,
)

METRIC_MODULES = [
	("ATS friendly", ats_friendly),
	("Grammar", grammar),
	("Date consistency", date_consistency),
	("Information completeness", information_completeness),
	("Education relevance", education_relevance),
	("Skill relevance", skill_relevance),
	("Experience relevance", experience_relevance),
	("Achievement relevance", achievement_relevance),
	("Certification relevance", certification_relevance),
]


def run_screening(
	file_path: str,
	metric_weights: list[dict[str, Any]],
	criteria: dict[str, Any],
	min_score_to_pass: float = 75.0,
	pass_description: str = "",
	fail_description: str = "",
	score_labels: list[dict[str, Any]] | None = None,
	min_text_chars_per_page: int = 200,
	metric_pass_threshold: float = 60.0,
) -> dict[str, Any]:
	"""Menjalankan seluruh alur penilaian CV dari berkas hingga hasil terstruktur."""
	# 1. Ekstraksi berkas
	extraction = extract_cv(file_path, min_text_chars_per_page=min_text_chars_per_page)

	if extraction.error:
		return {
			"status": "Failed",
			"error": extraction.error,
			"resume_text": extraction.raw_text,
			"total_score": 0.0,
			"passed": 0,
			"experience_level": "Fresh Graduate",
			"result_label": "Gagal Dievaluasi",
			"result_description": extraction.error,
			"result_indicator": "red",
			"results": [],
		}

	# 2. Segmentasi bagian
	sections = split_sections(extraction.normalized_text)

	# 3. Jalankan 9 metrik
	metric_results = []
	total_experience_years = 0.0

	for metric_name, module in METRIC_MODULES:
		eval_res = module.evaluate(extraction, sections, criteria)
		metric_results.append({
			"metric": metric_name,
			"score": eval_res["score"],
			"applicable": eval_res["applicable"],
			"reason": eval_res["reason"],
		})
		if metric_name == "Experience relevance":
			total_experience_years = float(eval_res.get("total_years", 0.0))

	# 4. Hitung skor total dan normalisasi bobot
	total_calc = calculate_total_score(
		metric_results=metric_results,
		metric_weights=metric_weights,
		min_score_to_pass=min_score_to_pass,
		pass_description=pass_description,
		fail_description=fail_description,
		score_labels=score_labels,
		metric_pass_threshold=metric_pass_threshold,
	)

	# 5. Tentukan experience_level: >= 1 tahun = Experienced, < 1 tahun = Fresh Graduate
	exp_level = "Experienced" if total_experience_years >= 1.0 else "Fresh Graduate"

	return {
		"status": "Done",
		"error": None,
		"resume_text": extraction.normalized_text,
		"total_score": total_calc["total_score"],
		"passed": total_calc["passed"],
		"experience_level": exp_level,
		"result_label": total_calc["result_label"],
		"result_description": total_calc["result_description"],
		"result_indicator": total_calc["result_indicator"],
		"results": total_calc["results"],
		"sections": sections,
	}
