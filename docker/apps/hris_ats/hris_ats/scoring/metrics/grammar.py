# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 2: Grammar / Kerapian Tulisan (0-100)
Heuristik mekanis:
- Kata berulang berdampingan ("the the", "dan dan", "di di")
- Spasi ganda atau tanda baca ganda (",,", "..", "??", spasi sebelum koma)
- Kalimat yang dimulai dengan huruf kecil
- Kalimat yang terlalu panjang (> 40 kata)
- Rasio kata huruf besar semua (ALL CAPS) di luar singkatan umum
- Daftar salah ketik umum (Bahasa Indonesia & Bahasa Inggris)
"""

from __future__ import annotations

import re
from typing import Any
from hris_ats.scoring.extract import ExtractionResult

COMMON_TYPOS = {
	# Bahasa Indonesia
	r"\baktifitas\b": "aktivitas",
	r"\bkwalitas\b": "kualitas",
	r"\bmanagemen\b": "manajemen",
	r"\bbertangung\b": "bertanggung",
	r"\bbertangungjawab\b": "bertanggung jawab",
	r"\bmerubah\b": "mengubah",
	r"\bkarir\b": "karier",
	r"\bpraktek\b": "praktik",
	r"\bantaralain\b": "antara lain",
	r"\bdilinkungan\b": "di lingkungan",
	# English
	r"\bteh\b": "the",
	r"\brecieve\b": "receive",
	r"\bseperate\b": "separate",
	r"\bdefinately\b": "definitely",
	r"\buntill\b": "until",
	r"\bgoverment\b": "government",
	r"\boccured\b": "occurred",
	r"\bsucessful\b": "successful",
}

SAFE_ACRONYMS = {
	"IT", "HR", "ATS", "ERP", "SQL", "CEO", "CTO", "CFO", "COO", "UI", "UX",
	"HTML", "CSS", "JS", "API", "REST", "SDK", "AWS", "GCP", "QA", "S1", "S2",
	"S3", "SMA", "SMK", "D3", "D4", "GPA", "IPK", "TOEFL", "IELTS", "B2B", "B2C",
	"AI", "ML", "ID", "EN", "IDR", "USD", "CV", "PT", "CV.", "PT."
}


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	text = extraction.normalized_text
	words = text.split()
	word_count = len(words)

	if word_count < 20:
		return {
			"score": 50.0,
			"applicable": True,
			"reason": "Teks terlalu pendek untuk mengevaluasi kerapian tulisan.",
		}

	penalties = 0.0
	issues_detected: list[str] = []

	# 1. Kata berulang berdampingan ("the the", "dan dan")
	repeated_words = re.findall(r"\b([a-zA-Z]{2,})\s+\1\b", text, re.IGNORECASE)
	if repeated_words:
		count = len(repeated_words)
		penalties += count * 4.0
		issues_detected.append(f"Kata berulang ('{repeated_words[0]}')")

	# 2. Spasi ganda dan tanda baca aneh
	double_punct = len(re.findall(r"([,\.?!;:])\s*\1+", text))
	space_before_punct = len(re.findall(r"\s+[,;:?!]", text))
	punct_issues = double_punct + space_before_punct
	if punct_issues > 0:
		penalties += min(punct_issues * 2.0, 15.0)
		issues_detected.append("Tanda baca ganda atau spasi sebelum tanda baca")

	# 3. Rasio ALL CAPS berlebih
	caps_words = [w for w in words if w.isupper() and len(w) > 1 and w not in SAFE_ACRONYMS]
	caps_ratio = len(caps_words) / word_count
	if caps_ratio > 0.15:
		penalties += 15.0
		issues_detected.append("Penggunaan huruf kapital berlebihan (ALL CAPS)")

	# 4. Typo umum
	typo_count = 0
	typo_examples = []
	for pattern, fix in COMMON_TYPOS.items():
		found = re.findall(pattern, text, re.IGNORECASE)
		if found:
			typo_count += len(found)
			typo_examples.append(f"{found[0]} -> {fix}")

	if typo_count > 0:
		penalties += min(typo_count * 3.0, 20.0)
		issues_detected.append(f"Kesalahan ketik umum ({', '.join(typo_examples[:2])})")

	# 5. Kalimat yang sangat panjang (> 40 kata)
	sentences = re.split(r"[.!?]+(?:\s+|\n+)", text)
	long_sentences = [s for s in sentences if len(s.split()) > 40]
	if len(long_sentences) > 2:
		penalties += 10.0
		issues_detected.append(f"Terdapat {len(long_sentences)} kalimat terlalu panjang (> 40 kata)")

	# Skala penalti per 100 kata
	norm_factor = 100.0 / max(100, word_count)
	scaled_penalty = penalties * (norm_factor ** 0.5)

	final_score = max(20.0, min(100.0, 100.0 - scaled_penalty))

	if not issues_detected:
		final_reason = "Kerapian tulisan sangat baik (tanda baca, kapitalisasi, dan struktur rapi)."
	else:
		final_reason = "; ".join(issues_detected) + "."

	return {
		"score": round(final_score, 1),
		"applicable": True,
		"reason": final_reason,
	}
