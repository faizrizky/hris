# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul klasifikasi temuan Article dan File berbasis leksikon murni (tanpa import frappe).
Menentukan kategori (Prestasi / Profesional / Berisiko / Netral) dan severity dengan penyesuaian confidence.
"""

from __future__ import annotations

import re
from typing import Any

SEVERITY_ORDER = ["Info", "Rendah", "Sedang", "Tinggi"]

PRESTASI_TERMS = [
	"juara", "meraih", "penghargaan", "award", "winner", "beasiswa",
	"lomba", "prestasi", "pemenang", "medali", "cumlaude", "honors"
]

PROFESIONAL_TERMS = [
	"narasumber", "pembicara", "peneliti", "proyek", "publikasi",
	"jurnal", "speaker", "keynote", "seminar", "workshop", "konferensi", "paper"
]


def downgrade_severity(severity: str) -> str:
	"""Menurunkan tingkat keparahan satu tingkat bila match_confidence < 80."""
	if severity == "Tinggi":
		return "Sedang"
	elif severity == "Sedang":
		return "Rendah"
	elif severity == "Rendah":
		return "Info"
	return "Info"


def classify_text(
	title: str,
	snippet: str,
	lexicon_items: list[dict[str, Any]] | None = None,
	match_confidence: int = 100,
) -> dict[str, Any]:
	"""Mengklasifikasikan artikel atau dokumen berdasarkan teks judul dan cuplikan."""
	full_text = f"{title or ''} {snippet or ''}".lower()
	lexicon = lexicon_items or []

	risk_flags = []
	matched_severities = []
	is_risk = False

	# Periksa leksikon risiko
	for item in lexicon:
		if not item.get("enabled", 1):
			continue

		term = str(item.get("term", "")).strip().lower()
		if not term:
			continue

		is_regex = item.get("is_regex", 0)
		matched = False

		if is_regex:
			try:
				if re.search(term, full_text):
					matched = True
			except re.error:
				pass
		else:
			# Cocokkan batas kata sederhana
			if re.search(r"\b" + re.escape(term) + r"\b", full_text):
				matched = True

		if matched:
			cat = item.get("category", "")
			sev = item.get("severity", "Sedang")
			risk_flags.append(f"{cat}: {term} ({sev})")
			matched_severities.append(sev)
			if sev in ("Sedang", "Tinggi"):
				is_risk = True

	# Urutkan keparahan tertinggi yang cocok
	highest_sev = "Info"
	for sev in SEVERITY_ORDER[::-1]:
		if sev in matched_severities:
			highest_sev = sev
			break

	# Tentukan kategori
	if is_risk:
		category = "Berisiko"
	elif any(re.search(r"\b" + re.escape(t) + r"\b", full_text) for t in PRESTASI_TERMS):
		category = "Prestasi"
		highest_sev = "Info"
	elif any(re.search(r"\b" + re.escape(t) + r"\b", full_text) for t in PROFESIONAL_TERMS):
		category = "Profesional"
		highest_sev = "Info"
	else:
		category = "Netral"
		highest_sev = "Info"

	# Penyesuaian: bila match_confidence < 80, turunkan satu tingkat
	final_severity = highest_sev
	if match_confidence < 80 and final_severity != "Info":
		final_severity = downgrade_severity(final_severity)

	return {
		"category": category,
		"severity": final_severity,
		"raw_severity": highest_sev,
		"risk_flags": ", ".join(risk_flags),
	}
