# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metric 8: Achievement relevance (0-100)
Evaluates presence of measurable work achievements:
- Numbers and quantitative metrics (%, Rp, IDR, USD, x, juta, miliar, orang, tim, users, projects)
- Accompanied by action verbs (memimpin, meningkatkan, led, increased, improved, reduced, built, managed)
- 20 points per finding, capped at 100 points (5 findings).
"""

from __future__ import annotations

import json
import re
from typing import Any

from hris_ats.scoring.extract import ExtractionResult

ACTION_VERBS = [
	# Indonesian
	r"memimpin", r"meningkatkan", r"mengembangkan", r"memangkas", r"membangun",
	r"merancang", r"mendesain", r"mengelola", r"mengoptimalkan", r"menghasilkan",
	r"mencapai", r"meluncurkan", r"mengurangi", r"mengimplementasikan",
	# English
	r"led", r"lead", r"increased", r"improved", r"reduced", r"decreased",
	r"developed", r"built", r"designed", r"managed", r"optimized",
	r"generated", r"achieved", r"launched", r"delivered", r"scaled",
]

METRIC_UNITS = [
	r"%", r"persen", r"percent",
	r"rp\.?", r"idr", r"usd", r"\$",
	r"\b\d+\s*x\b", r"\bkali\b",
	r"juta", r"miliar", r"milyar", r"million", r"billion",
	r"orang", r"anggota", r"karyawan", r"tim", r"members?", r"people",
	r"proyek", r"project", r"projek",
	r"pengguna", r"user", r"users", r"klien", r"clients?", r"customers?",
]

ACTION_REGEX = re.compile(r"\b(?:" + "|".join(ACTION_VERBS) + r")\b", re.IGNORECASE)
METRIC_REGEX = re.compile(r"(?:" + "|".join(METRIC_UNITS) + r")", re.IGNORECASE)
NUMBER_REGEX = re.compile(r"\b\d+(?:[\.,]\d+)?\b")


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	search_text = (
		sections.get("achievements", "") + "\n" +
		sections.get("experience", "") + "\n" +
		extraction.normalized_text
	)

	lines = search_text.split("\n")
	matched_achievements: list[str] = []

	for line in lines:
		l = line.strip()
		if len(l) < 15:
			continue

		has_action = bool(ACTION_REGEX.search(l))
		has_metric = bool(METRIC_REGEX.search(l))
		has_number = bool(NUMBER_REGEX.search(l))

		if (has_action and has_metric and has_number) or (has_metric and has_number and any(sym in l for sym in ["%", "Rp", "$"])):
			if not any(l[:20] in m for m in matched_achievements):
				matched_achievements.append(l)

	count = len(matched_achievements)
	score = min(100.0, count * 20.0)
	params: dict[str, Any] = {}

	if count == 0:
		final_reason = "No measurable achievements found with numbers or quantitative metrics."
		final_template = final_reason
	elif count >= 5:
		final_reason = f"Found {count} measurable achievements with metrics and tangible impact (maximum 100 points)."
		final_template = "Found {count} measurable achievements with metrics and tangible impact (maximum 100 points)."
		params["count"] = count
	else:
		final_reason = f"Found {count} measurable work achievements (e.g. percentages, amounts, or project scale)."
		final_template = "Found {count} measurable work achievements (e.g. percentages, amounts, or project scale)."
		params["count"] = count

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
		"reason_template": final_template,
		"reason_params": json.dumps(params) if params else "{}",
		"findings_count": count,
		"first_finding": matched_achievements[0][:160] if matched_achievements else "",
	}
