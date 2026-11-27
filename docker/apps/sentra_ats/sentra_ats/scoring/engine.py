# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Engine evaluasi skrining CV utama (murni, tanpa import frappe).
Menggabungkan ekstraksi teks, segmentasi bagian, evaluasi 9 metrik, dan kalkulasi skor total.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from sentra_ats.scoring.extract import ExtractionResult, extract_cv

# 9 modul metrik
from sentra_ats.scoring.metrics import (
	achievement_relevance,
	ats_friendly,
	certification_relevance,
	date_consistency,
	education_relevance,
	experience_relevance,
	grammar,
	information_completeness,
	skill_relevance,
)
from sentra_ats.scoring.rules import apply_rules, calculate_confidence, detect_language, say
from sentra_ats.scoring.sections import split_sections
from sentra_ats.scoring.total import calculate_total_score, match_label

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


def evaluate_resume(
	extraction: ExtractionResult,
	template: dict[str, Any],
	criteria: dict[str, Any],
	metric_pass_threshold: float = 60.0,
	on_metric_done: Callable[[str, int, int], None] | None = None,
) -> dict[str, Any]:
	"""Score one extracted CV with one template configuration (shared by screening and simulation).

	`template` keys: metric_weights, score_labels, min_score_to_pass, pass_description,
	fail_description, penalty_rules, custom_rules, knockout_rules, allowed_languages.
	"""
	# Gate 1: unreadable CVs (scan, encrypted, unsupported) go to manual review, not a zero score
	if extraction.error:
		return _needs_review(extraction, extraction.error)

	# Gate 2: only the languages the template allows (stopword lists exist for id/en only)
	allowed = [x.strip().lower() for x in (template.get("allowed_languages") or "").split(",") if x.strip()]
	language = detect_language(extraction.normalized_text)
	if allowed and language and language not in allowed:
		message: dict[str, Any] = {}
		say(message, "CV language '{language}' is not processed by this template (allowed: {allowed}).", language=language, allowed=", ".join(allowed))
		return _needs_review(extraction, message["reason"], language, message)

	sections = split_sections(extraction.normalized_text)
	metric_results = []
	signals: dict[str, Any] = {}
	for idx, (metric_name, module) in enumerate(METRIC_MODULES, start=1):
		eval_res = module.evaluate(extraction, sections, criteria)
		metric_results.append({
			"metric": metric_name,
			"score": eval_res["score"],
			"applicable": eval_res["applicable"],
			"reason": eval_res["reason"],
			"reason_template": eval_res.get("reason_template", eval_res["reason"]),
			"reason_params": eval_res.get("reason_params", "{}"),
		})
		if metric_name == "Experience relevance":
			signals["total_years"] = float(eval_res.get("total_years", 0.0))
		elif metric_name == "Achievement relevance":
			signals["achievement_count"] = int(eval_res.get("findings_count", 0))
			signals["achievement_example"] = eval_res.get("first_finding", "")
		elif metric_name == "Grammar":
			signals["word_count"] = int(eval_res.get("word_count", 0))
			signals["typo_count"] = int(eval_res.get("typo_count", 0))
			signals["typo_example"] = eval_res.get("typo_example", "")
		if on_metric_done:
			on_metric_done(metric_name, idx, len(METRIC_MODULES))

	base = calculate_total_score(
		metric_results=metric_results,
		metric_weights=template.get("metric_weights") or [],
		min_score_to_pass=template.get("min_score_to_pass") or 75.0,
		pass_description=template.get("pass_description") or "",
		fail_description=template.get("fail_description") or "",
		score_labels=template.get("score_labels"),
		metric_pass_threshold=metric_pass_threshold,
	)
	ruled = apply_rules(
		base_score=base["total_score"],
		extraction=extraction,
		sections=sections,
		signals=signals,
		penalty_rules=template.get("penalty_rules") or [],
		custom_rules=template.get("custom_rules") or [],
		knockout_rules=template.get("knockout_rules") or [],
	)
	final = ruled["final_score"]
	label = match_label(
		final,
		template.get("score_labels"),
		template.get("min_score_to_pass") or 75.0,
		template.get("pass_description") or "",
		template.get("fail_description") or "",
	)
	confidence, confidence_message = calculate_confidence(metric_results, sections)
	total_years = signals.get("total_years", 0.0)
	return {
		"status": "Done",
		"error": None,
		"resume_text": extraction.normalized_text,
		"base_score": base["total_score"],
		"penalty_points": ruled["penalty_points"],
		"total_score": final,
		"passed": label["passed"],
		"needs_hr_review": ruled["needs_hr_review"],
		"experience_level": "Experienced" if total_years >= 1.0 else "Fresh Graduate",
		"result_label": label["result_label"],
		"result_description": label["result_description"],
		"result_indicator": label["result_indicator"],
		"results": base["results"],
		"rule_results": ruled["rule_results"],
		"confidence": confidence,
		"confidence_reason": confidence_message["reason"],
		"message_data": json.dumps({"confidence": confidence_message}, ensure_ascii=False),
		"detected_language": language,
		"review_reason": "",
		"sections": sections,
	}


def _needs_review(
	extraction: ExtractionResult, reason: str, language: str = "", message: dict[str, Any] | None = None
) -> dict[str, Any]:
	return {
		"message_data": json.dumps({"review": message} if message else {}, ensure_ascii=False),
		"status": "Needs Review",
		"error": reason,
		"resume_text": extraction.raw_text,
		"base_score": 0.0,
		"penalty_points": 0.0,
		"total_score": 0.0,
		"passed": 0,
		"needs_hr_review": 1,
		"experience_level": "",
		"result_label": "Needs Manual Review",
		"result_description": reason,
		"result_indicator": "orange",
		"results": [],
		"rule_results": [],
		"confidence": "Low",
		"confidence_reason": reason,
		"detected_language": language,
		"review_reason": reason,
		"sections": {},
	}


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
	penalty_rules: list[dict[str, Any]] | None = None,
	custom_rules: list[dict[str, Any]] | None = None,
	knockout_rules: list[dict[str, Any]] | None = None,
	allowed_languages: str = "",
) -> dict[str, Any]:
	"""Extract a CV file and score it (kept for callers that pass a file path)."""
	extraction = extract_cv(file_path, min_text_chars_per_page=min_text_chars_per_page)
	return evaluate_resume(
		extraction,
		{
			"metric_weights": metric_weights,
			"score_labels": score_labels,
			"min_score_to_pass": min_score_to_pass,
			"pass_description": pass_description,
			"fail_description": fail_description,
			"penalty_rules": penalty_rules,
			"custom_rules": custom_rules,
			"knockout_rules": knockout_rules,
			"allowed_languages": allowed_languages,
		},
		criteria,
		metric_pass_threshold=metric_pass_threshold,
	)
