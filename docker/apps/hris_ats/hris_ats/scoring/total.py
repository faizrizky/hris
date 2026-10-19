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
	applicable_results = []
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

	total_score_int = int(round(weighted_sum))
	total_score_int = max(0, min(100, total_score_int))
	passed = 1 if total_score_int >= min_score_to_pass else 0

	# Pencocokan Score Label
	matched_label = None
	matched_desc = None
	matched_indicator = None

	if score_labels:
		for lbl in score_labels:
			l_type = lbl.get("label_type", "Range")
			s_from = int(lbl.get("score_from", 0))

			if l_type == "Fixed":
				if total_score_int == s_from:
					matched_label = lbl.get("label")
					matched_desc = lbl.get("description")
					matched_indicator = lbl.get("indicator", "green")
					break
			else:
				s_to = int(lbl.get("score_to", 100))
				if s_from <= total_score_int <= s_to:
					matched_label = lbl.get("label")
					matched_desc = lbl.get("description")
					matched_indicator = lbl.get("indicator", "green")
					break

	# Fallback bila tidak ada label yang cocok
	if not matched_label:
		if passed:
			matched_label = "Qualified"
			matched_desc = pass_description or "Applicant resume matches the applied job!"
			matched_indicator = "green"
		else:
			matched_label = "Not Qualified"
			matched_desc = fail_description or "Applicant resume does not meet the minimum criteria."
			matched_indicator = "red"


	return {
		"total_score": float(total_score_int),
		"passed": passed,
		"result_label": matched_label,
		"result_description": matched_desc,
		"result_indicator": matched_indicator,
		"results": detailed_results,
	}
