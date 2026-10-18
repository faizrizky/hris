# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 8: Achievement relevance (0-100)
Mengevaluasi keberadaan pencapaian kerja yang terukur:
- Poin dengan angka dan metrik kuantitatif (%, Rp, IDR, USD, x, juta, miliar, orang, tim, pengguna, proyek)
- Disertai kata kerja aksi (memimpin, meningkatkan, mengembangkan, led, increased, improved, reduced, built, managed)
- Skor naik 20 poin per temuan, maksimal 100 poin (5 temuan).
"""

from __future__ import annotations

import re
from typing import Any
from hris_ats.scoring.extract import ExtractionResult

ACTION_VERBS = [
	# Bahasa Indonesia
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
	# Prioritaskan bagian achievements dan experience
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
			# Hindari duplikasi kalimat yang mirip
			if not any(l[:20] in m for m in matched_achievements):
				matched_achievements.append(l)

	count = len(matched_achievements)
	score = min(100.0, count * 20.0)

	if count == 0:
		final_reason = "Belum ada pencapaian kerja yang terukur dengan angka atau metrik kuantitatif."
	elif count >= 5:
		final_reason = f"Ditemukan {count} pencapaian terukur dengan metrik dan dampak nyata (maksimal 100 poin)."
	else:
		final_reason = f"Ditemukan {count} pencapaian kerja yang terukur (mis. persentase, nominal, atau skala proyek)."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
		"findings_count": count,
	}
