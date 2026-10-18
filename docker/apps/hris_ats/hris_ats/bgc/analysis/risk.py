# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul penentuan tingkat risiko otomatis (risk_level_auto) murni (tanpa import frappe).
Menerapkan aturan SPEC-BACKGROUND-CHECK.md bagian 6.6.
"""

from __future__ import annotations

from typing import Any


def calculate_risk_level(
	findings: list[dict[str, Any]],
	politeness_score: int = 100,
	min_confidence: int = 50,
) -> str:
	"""Menghitung tingkat risiko otomatis: 'Perlu verifikasi', 'Tinggi', 'Sedang', 'Rendah'.

	Aturan:
	- 'Perlu verifikasi': ada temuan severity Tinggi yang belum ditinjau HR (hr_verdict == 'Belum ditinjau').
	- 'Tinggi': ada temuan severity Tinggi yang telah ditandai 'Relevan'.
	- 'Sedang': >= 3 temuan Sedang yang 'Relevan', ATAU politeness_score < 60.
	- 'Rendah': selain itu.
	"""
	valid_findings = [
		f for f in (findings or [])
		if f.get("match_confidence", 0) >= min_confidence
	]

	has_unreviewed_high = False
	has_relevant_high = False
	relevant_medium_count = 0

	for f in valid_findings:
		severity = f.get("severity", "Info")
		verdict = f.get("hr_verdict", "Belum ditinjau")

		if severity == "Tinggi":
			if verdict == "Relevan":
				has_relevant_high = True
			elif verdict == "Belum ditinjau":
				has_unreviewed_high = True

		elif severity == "Sedang":
			if verdict == "Relevan":
				relevant_medium_count += 1

	# Evaluasi hierarki
	if has_unreviewed_high:
		return "Perlu verifikasi"
	elif has_relevant_high:
		return "Tinggi"
	elif relevant_medium_count >= 3 or politeness_score < 60:
		return "Sedang"
	else:
		return "Rendah"
