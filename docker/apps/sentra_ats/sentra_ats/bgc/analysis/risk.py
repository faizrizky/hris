# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pure module for automated risk level calculation (risk_level_auto).
Implements SPEC-BACKGROUND-CHECK.md section 6.6 rules:
- 'Needs verification': Unreviewed High severity finding exists (hr_verdict == 'Not reviewed' / 'Belum ditinjau')
- 'High': High severity finding confirmed 'Relevant' / 'Relevan' by HR
- 'Medium': >= 3 Medium findings confirmed 'Relevant', OR politeness_score < 60
- 'Low': otherwise.
"""

from __future__ import annotations

from typing import Any


def calculate_risk_level(
	findings: list[dict[str, Any]],
	politeness_score: int = 100,
	min_confidence: int = 50,
) -> str:
	valid_findings = [
		f for f in (findings or [])
		if f.get("match_confidence", 0) >= min_confidence
	]

	has_unreviewed_high = False
	has_relevant_high = False
	relevant_medium_count = 0

	for f in valid_findings:
		severity = f.get("severity", "Info")
		verdict = f.get("hr_verdict", "Not reviewed")

		is_high = severity in ("High", "Tinggi")
		is_medium = severity in ("Medium", "Sedang")
		is_relevant = verdict in ("Relevant", "Relevan")
		is_unreviewed = verdict in ("Not reviewed", "Belum ditinjau")

		if is_high:
			if is_relevant:
				has_relevant_high = True
			elif is_unreviewed:
				has_unreviewed_high = True

		elif is_medium:
			if is_relevant:
				relevant_medium_count += 1

	if has_unreviewed_high:
		return "Needs verification"
	elif has_relevant_high:
		return "High"
	elif relevant_medium_count >= 3 or politeness_score < 60:
		return "Medium"
	else:
		return "Low"
