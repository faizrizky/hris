# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metric 7: Experience relevance (0-100)
Evaluates work experience relevance and duration:
- Merges overlapping job date ranges (union)
- 70 points = min(total_years / min_years_experience, 1.0) * 70
- 30 points = relevant job titles match (rapidfuzz token_set_ratio >= 85)
- If neither specified in criteria, applicable = False.
"""

from __future__ import annotations

import json
import re
from typing import Any

from rapidfuzz import fuzz

from sentra_ats.scoring.extract import ExtractionResult
from sentra_ats.scoring.metrics.date_consistency import extract_date_ranges


def calculate_total_experience_years(ranges: list[dict[str, Any]]) -> float:
	"""Merges work date ranges (union) so overlapping periods are counted once."""
	if not ranges:
		return 0.0

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
		msg = "Job opening does not specify minimum years of experience or relevant job title criteria."
		return {
			"score": 100.0,
			"applicable": False,
			"reason": msg,
			"reason_template": msg,
			"reason_params": "{}",
			"total_years": 0.0,
		}

	exp_text = sections.get("experience", "") or extraction.normalized_text
	ranges = extract_date_ranges(exp_text)
	total_years = calculate_total_experience_years(ranges)

	score = 0.0
	reasons: list[str] = []
	template_parts: list[str] = []
	params: dict[str, Any] = {}

	# 1. Experience duration (up to 70 points)
	if min_years > 0.0:
		ratio = min(1.0, total_years / min_years)
		duration_points = ratio * 70.0
		score += duration_points
		if total_years >= min_years:
			reasons.append(f"Experience of {total_years} years meets minimum requirement of {min_years} years")
			template_parts.append("Experience of {years} years meets minimum requirement of {min_years} years")
		else:
			reasons.append(f"Experience of {total_years} years out of minimum {min_years} years")
			template_parts.append("Experience of {years} years out of minimum {min_years} years")
		params["years"] = total_years
		params["min_years"] = min_years
	else:
		score += 70.0 if total_years > 0 else 35.0
		reasons.append(f"Total detected experience: {total_years} years")
		template_parts.append("Total detected experience: {years} years")
		params["years"] = total_years

	# 2. Relevant job titles (up to 30 points)
	if titles_list:
		matched_titles: list[str] = []
		for title in titles_list:
			title_clean = title.lower()
			for line in exp_text.split("\n"):
				if fuzz.token_set_ratio(title_clean, line.lower()) >= 85:
					matched_titles.append(title)
					break

		if matched_titles:
			score += 30.0
			titles_str = ", ".join(sorted(set(matched_titles)))
			reasons.append(f"Relevant job title matched: {titles_str}")
			template_parts.append("Relevant job title matched: {titles}")
			params["titles"] = titles_str
		else:
			sample_titles = ", ".join(titles_list[:2])
			reasons.append(f"No relevant job titles found ({sample_titles})")
			template_parts.append("No relevant job titles found ({titles})")
			params["titles"] = sample_titles
	else:
		score += 30.0 if total_years > 0 else 15.0

	final_score = max(0.0, min(100.0, score))
	final_reason = "; ".join(reasons) + "."
	final_template = "; ".join(template_parts) + "."

	return {
		"score": round(final_score, 1),
		"applicable": True,
		"reason": final_reason,
		"reason_template": final_template,
		"reason_params": json.dumps(params) if params else "{}",
		"total_years": total_years,
	}
