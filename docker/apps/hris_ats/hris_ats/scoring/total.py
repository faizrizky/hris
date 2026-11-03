# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Kalkulasi skor akhir, normalisasi bobot, dan pencocokan label hasil screening (fungsi murni).
"""

from __future__ import annotations

from typing import Any


def calculate_total_score(
	metric_results: list[dict[str, Any]],
	metric_weights: list[dict[str, Any]],
	min_score_to_pass: float = 75.0,
	pass_description: str = "",
	fail_description: str = "",
	score_labels: list[dict[str, Any]] | None = None,
	metric_pass_threshold: float = 60.0,
) -> dict[str, Any]:
	"""Menghitung skor total terbobot dan menentukan status lolos/label.

	- Metrik yang tidak berlaku (applicable = False) bobotnya dibagi ulang secara proporsional
	- Skor total dibulatkan ke bilangan bulat (integer)
	- Pencocokan label (Fixed / Range)
	- Fallback ke pass_description / fail_description jika tidak ada label yang cocok
	"""
	# Petakan bobot template berdasarkan nama metrik
	weights_map: dict[str, float] = {}
	for w in metric_weights:
		if w.get("enabled", True):
			weights_map[w["metric"]] = float(w.get("weight", 0.0))

	# Identifikasi metrik yang aktif dan applicable
	sum_applicable_weights = 0.0

	for res in metric_results:
		metric_name = res["metric"]
		orig_weight = weights_map.get(metric_name, 0.0)
		is_app = res.get("applicable", True)

		if orig_weight > 0 and is_app:
			sum_applicable_weights += orig_weight

	# Hitung bobot efektif dan kontribusi skor
	detailed_results = []
	weighted_sum = 0.0

	for res in metric_results:
		metric_name = res["metric"]
		orig_weight = weights_map.get(metric_name, 0.0)
		is_app = res.get("applicable", True)
		score = float(res.get("score", 0.0))

		if is_app and sum_applicable_weights > 0:
			effective_weight = (orig_weight / sum_applicable_weights) * 100.0
			weighted_sum += (score * (effective_weight / 100.0))
		else:
			effective_weight = 0.0

		metric_passed = score >= metric_pass_threshold if is_app else True

		detailed_results.append({
			"metric": metric_name,
			"score": round(score, 1),
			"weight": round(effective_weight, 2),
			"original_weight": round(orig_weight, 2),
			"applicable": is_app,
			"passed": 1 if metric_passed else 0,
			"metric_status": "Done",
			"reason": res.get("reason", ""),
			"reason_template": res.get("reason_template", res.get("reason", "")),
			"reason_params": res.get("reason_params", "{}"),
		})

	total_score_int = max(0, min(100, round(weighted_sum)))
	label = match_label(total_score_int, score_labels, min_score_to_pass, pass_description, fail_description)

	return {
		"total_score": float(total_score_int),
		"passed": label["passed"],
		"result_label": label["result_label"],
		"result_description": label["result_description"],
		"result_indicator": label["result_indicator"],
		"results": detailed_results,
	}


def match_label(
	score: float,
	score_labels: list[dict[str, Any]] | None,
	min_score_to_pass: float = 75.0,
	pass_description: str = "",
	fail_description: str = "",
) -> dict[str, Any]:
	"""Tier/label for a final score (Fixed or Range labels), with pass/fail fallback."""
	score_int = round(score)
	passed = 1 if score_int >= min_score_to_pass else 0
	for lbl in score_labels or []:
		s_from = int(lbl.get("score_from", 0))
		if lbl.get("label_type", "Range") == "Fixed":
			hit = score_int == s_from
		else:
			hit = s_from <= score_int <= int(lbl.get("score_to", 100))
		if hit:
			return {
				"passed": passed,
				"result_label": lbl.get("label"),
				"result_description": lbl.get("description"),
				"result_indicator": lbl.get("indicator", "green"),
			}
	if passed:
		return {
			"passed": 1,
			"result_label": "Qualified",
			"result_description": pass_description or "Applicant resume matches the applied job!",
			"result_indicator": "green",
		}
	return {
		"passed": 0,
		"result_label": "Not Qualified",
		"result_description": fail_description or "Applicant resume does not meet the minimum criteria.",
		"result_indicator": "red",
	}
