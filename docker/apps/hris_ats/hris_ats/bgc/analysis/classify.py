# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul klasifikasi temuan Article dan File berbasis leksikon murni (tanpa import frappe).
Menentukan kategori (Prestasi / Profesional / Berisiko / Netral) dan severity dengan penyesuaian confidence.
"""

from __future__ import annotations

import re
from typing import Any

SEVERITY_ORDER = ["Info", "Low", "Medium", "High"]

PRESTASI_TERMS = [
	"juara", "meraih", "penghargaan", "award", "winner", "beasiswa",
	"lomba", "prestasi", "pemenang", "medali", "cumlaude", "honors"
]

PROFESIONAL_TERMS = [
	"narasumber", "pembicara", "peneliti", "proyek", "publikasi",
	"jurnal", "speaker", "keynote", "seminar", "workshop", "konferensi", "paper"
]

SEV_NORM_MAP = {
	"tinggi": "High", "sedang": "Medium", "rendah": "Low", "info": "Info",
	"high": "High", "medium": "Medium", "low": "Low",
}

CAT_NORM_MAP = {
	"berisiko": "Risky", "prestasi": "Achievement", "profesional": "Professional", "netral": "Neutral",
	"risky": "Risky", "achievement": "Achievement", "professional": "Professional", "neutral": "Neutral",
}


def downgrade_severity(severity: str) -> str:
	"""Lowers severity by one level when match_confidence < 80."""
	s = SEV_NORM_MAP.get(str(severity).strip().lower(), "Info")
	if s == "High":
		return "Medium"
	elif s == "Medium":
		return "Low"
	elif s == "Low":
		return "Info"
	return "Info"


def classify_text(
	title: str,
	snippet: str,
	lexicon_items: list[dict[str, Any]] | None = None,
	match_confidence: int = 100,
) -> dict[str, Any]:
	"""Classifies an article or document based on title and snippet text."""
	full_text = f"{title or ''} {snippet or ''}".lower()
	lexicon = lexicon_items or []

	risk_flags = []
	matched_severities = []
	is_risk = False

	# Check risk lexicon
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
			if re.search(r"\b" + re.escape(term) + r"\b", full_text):
				matched = True

		if matched:
			raw_cat = item.get("category", "")
			cat = CAT_NORM_MAP.get(raw_cat.strip().lower(), raw_cat)
			raw_sev = item.get("severity", "Medium")
			sev = SEV_NORM_MAP.get(str(raw_sev).strip().lower(), "Medium")
			risk_flags.append(f"{cat}: {term} ({sev})")
			matched_severities.append(sev)
			if sev in ("Medium", "High"):
				is_risk = True

	# Determine highest matched severity
	highest_sev = "Info"
	for sev in SEVERITY_ORDER[::-1]:
		if sev in matched_severities:
			highest_sev = sev
			break

	# Determine category
	if is_risk:
		category = "Risky"
	elif any(re.search(r"\b" + re.escape(t) + r"\b", full_text) for t in PRESTASI_TERMS):
		category = "Achievement"
		highest_sev = "Info"
	elif any(re.search(r"\b" + re.escape(t) + r"\b", full_text) for t in PROFESIONAL_TERMS):
		category = "Professional"
		highest_sev = "Info"
	else:
		category = "Neutral"
		highest_sev = "Info"

	# When match_confidence < 80, downgrade severity by one level
	final_severity = highest_sev
	if match_confidence < 80 and final_severity != "Info":
		final_severity = downgrade_severity(final_severity)

	flags_str = ", ".join(risk_flags)
	return {
		"category": category,
		"severity": final_severity,
		"raw_severity": highest_sev,
		"risk_flags": flags_str,
		"risk_flags_template": flags_str,
		"risk_flags_params": "{}",
	}
