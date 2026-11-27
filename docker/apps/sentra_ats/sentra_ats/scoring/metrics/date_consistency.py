# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metric 3: Date consistency (0-100)
Evaluates dating consistency and plausibility:
- Single dominant date format (>= 80%)
- Start date <= end date
- No future dates
- Chronological ordering
- Overlapping job dates detection (light penalty + recorded in reason)
- Career gap > 12 months recorded (informational, no penalty)
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from sentra_ats.scoring.extract import ExtractionResult

MONTH_MAP = {
	"jan": 1, "januari": 1, "january": 1,
	"feb": 2, "februari": 2, "february": 2,
	"mar": 3, "maret": 3, "march": 3,
	"apr": 4, "april": 4,
	"mei": 5, "may": 5,
	"jun": 6, "juni": 6, "june": 6,
	"jul": 7, "juli": 7, "july": 7,
	"agu": 8, "agustus": 8, "aug": 8, "august": 8,
	"sep": 9, "september": 9,
	"okt": 10, "oktober": 10, "oct": 10, "october": 10,
	"nov": 11, "november": 11,
	"des": 12, "desember": 12, "dec": 12, "december": 12,
}

NOW_YEAR = datetime.now().year
NOW_MONTH = datetime.now().month


def parse_date_token(token: str) -> tuple[int, int] | None:
	"""Converts date string token to (year, month)."""
	token = token.strip().lower()
	if token in ("sekarang", "present", "current", "saat ini"):
		return (NOW_YEAR, NOW_MONTH)

	# Format: Month Year
	m_name = re.match(r"^([a-z]+)\s+(\d{4})$", token)
	if m_name:
		name, yr = m_name.groups()
		month = MONTH_MAP.get(name)
		if month:
			return (int(yr), month)

	# Format: MM/YYYY or MM-YYYY
	m_slash = re.match(r"^(\d{1,2})[/\-](\d{4})$", token)
	if m_slash:
		mo, yr = m_slash.groups()
		mo_int = int(mo)
		if 1 <= mo_int <= 12:
			return (int(yr), mo_int)

	# Format: YYYY
	m_yr = re.match(r"^(\d{4})$", token)
	if m_yr:
		return (int(m_yr.group(1)), 1)

	return None


def extract_date_ranges(text: str) -> list[dict[str, Any]]:
	"""Extracts date ranges (start, end) with surrounding context."""
	results = []
	range_pattern = re.compile(
		r"((?:[a-zA-Z]+|\d{1,2}[/\-])?\s*\d{4})\s*(?:-|–|—|to|s/d|sampai)\s*((?:[a-zA-Z]+\s+)?\d{4}|sekarang|present|current|saat ini)",
		re.IGNORECASE,
	)

	for match in range_pattern.finditer(text):
		start_raw, end_raw = match.groups()
		p_start = parse_date_token(start_raw)
		p_end = parse_date_token(end_raw)

		fmt = "year_only"
		if re.search(r"[a-zA-Z]+", start_raw):
			fmt = "month_name"
		elif "/" in start_raw or "-" in start_raw:
			fmt = "numeric_month"

		if p_start and p_end:
			start_idx = max(0, match.start() - 100)
			end_idx = min(len(text), match.end() + 100)
			context = text[start_idx:end_idx]

			results.append({
				"start": p_start,
				"end": p_end,
				"format": fmt,
				"raw_start": start_raw.strip(),
				"raw_end": end_raw.strip(),
				"context": context,
			})

	return results


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	search_text = (
		sections.get("experience", "") + "\n" +
		sections.get("education", "") + "\n" +
		extraction.normalized_text
	)

	ranges = extract_date_ranges(search_text)

	if not ranges:
		msg = "No date ranges found to evaluate consistency."
		return {
			"score": 70.0,
			"applicable": True,
			"reason": msg,
			"reason_template": msg,
			"reason_params": "{}",
		}

	penalties = 0.0
	reasons: list[str] = []
	template_parts: list[str] = []
	params: dict[str, Any] = {}

	# 1. Date formatting consistency
	formats = [r["format"] for r in ranges]
	counts = {}
	for f in formats:
		counts[f] = counts.get(f, 0) + 1

	dominant_count = max(counts.values()) if counts else 0
	dominant_pct = (dominant_count / len(formats)) * 100.0

	if dominant_pct < 80.0:
		penalties += 15.0
		reasons.append(f"Mixed date formats ({dominant_pct:.0f}% dominant format)")
		template_parts.append("Mixed date formats ({dominant_pct:.0f}% dominant format)")
		params["dominant_pct"] = dominant_pct

	# 2. Start date <= End date
	inverted_ranges = []
	for r in ranges:
		sy, sm = r["start"]
		ey, em = r["end"]
		if (sy > ey) or (sy == ey and sm > em):
			inverted_ranges.append(f"{r['raw_start']}-{r['raw_end']}")

	if inverted_ranges:
		penalties += min(len(inverted_ranges) * 20.0, 40.0)
		reasons.append(f"Start date is later than end date ({inverted_ranges[0]})")
		template_parts.append("Start date is later than end date ({range})")
		params["range"] = inverted_ranges[0]

	# 3. Future dates
	future_dates = 0
	for r in ranges:
		sy, sm = r["start"]
		ey, em = r["end"]
		if sy > NOW_YEAR or (sy == NOW_YEAR and sm > (NOW_MONTH + 1)):
			future_dates += 1
		if ey > NOW_YEAR or (ey == NOW_YEAR and em > (NOW_MONTH + 1)):
			future_dates += 1

	if future_dates > 0:
		penalties += 20.0
		msg = "Future employment date detected"
		reasons.append(msg)
		template_parts.append(msg)

	# 4. Overlapping job dates
	overlaps: list[str] = []
	sorted_ranges = sorted(ranges, key=lambda x: (x["start"][0], x["start"][1]))

	for i in range(len(sorted_ranges)):
		for j in range(i + 1, len(sorted_ranges)):
			r1 = sorted_ranges[i]
			r2 = sorted_ranges[j]
			_s1, e1 = r1["start"], r1["end"]
			s2, _e2 = r2["start"], r2["end"]

			overlap_months = (e1[0] - s2[0]) * 12 + (e1[1] - s2[1])
			if overlap_months > 1:
				overlaps.append(f"{r1['raw_start']}-{r1['raw_end']} with {r2['raw_start']}-{r2['raw_end']}")

	if overlaps:
		penalties += 10.0
		reasons.append(f"Overlapping job dates ({overlaps[0]})")
		template_parts.append("Overlapping job dates ({overlap})")
		params["overlap"] = overlaps[0]

	# 5. Career gap > 12 months (informational)
	has_gap = False
	for i in range(len(sorted_ranges) - 1):
		cur_end = sorted_ranges[i]["end"]
		next_start = sorted_ranges[i + 1]["start"]
		gap_months = (next_start[0] - cur_end[0]) * 12 + (next_start[1] - cur_end[1])
		if gap_months > 12:
			has_gap = True
			break

	if has_gap:
		msg = "Career gap > 12 months detected (informational)"
		reasons.append(msg)
		template_parts.append(msg)

	final_score = max(0.0, min(100.0, 100.0 - penalties))

	if not reasons:
		final_reason = "Date formatting is consistent and chronological order is neat."
		final_template = final_reason
	else:
		final_reason = "; ".join(reasons) + "."
		final_template = "; ".join(template_parts) + "."

	return {
		"score": round(final_score, 1),
		"applicable": True,
		"reason": final_reason,
		"reason_template": final_template,
		"reason_params": json.dumps(params) if params else "{}",
	}
