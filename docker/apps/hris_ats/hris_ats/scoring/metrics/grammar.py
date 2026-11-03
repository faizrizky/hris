# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metric 2: Grammar / Writing Quality (0-100)
Mechanical heuristics:
- Adjacent repeated words ("the the", "dan dan", "di di")
- Double punctuation or punctuation spacing
- All-caps word ratio outside standard acronyms
- Common typographical errors (Indonesian & English)
- Overly long sentences (> 40 words)
"""

from __future__ import annotations

import json
import re
from typing import Any

from hris_ats.scoring.extract import ExtractionResult

COMMON_TYPOS = {
	# Indonesian
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
		msg = "Text is too short to evaluate writing quality."
		return {
			"score": 50.0,
			"applicable": True,
			"reason": msg,
			"reason_template": msg,
			"reason_params": "{}",
		}

	penalties = 0.0
	issues_detected: list[str] = []
	template_parts: list[str] = []
	params: dict[str, Any] = {}

	# 1. Repeated words
	repeated_words = re.findall(r"\b([a-zA-Z]{2,})\s+\1\b", text, re.IGNORECASE)
	if repeated_words:
		count = len(repeated_words)
		penalties += count * 4.0
		issues_detected.append(f"Repeated words ('{repeated_words[0]}')")
		template_parts.append("Repeated words ('{repeated_word}')")
		params["repeated_word"] = repeated_words[0]

	# 2. Punctuation
	double_punct = len(re.findall(r"([,\.?!;:])\s*\1+", text))
	space_before_punct = len(re.findall(r"\s+[,;:?!]", text))
	punct_issues = double_punct + space_before_punct
	if punct_issues > 0:
		penalties += min(punct_issues * 2.0, 15.0)
		msg = "Double punctuation or space before punctuation"
		issues_detected.append(msg)
		template_parts.append(msg)

	# 3. ALL CAPS
	caps_words = [w for w in words if w.isupper() and len(w) > 1 and w not in SAFE_ACRONYMS]
	caps_ratio = len(caps_words) / word_count
	if caps_ratio > 0.15:
		penalties += 15.0
		msg = "Excessive capitalization (ALL CAPS)"
		issues_detected.append(msg)
		template_parts.append(msg)

	# 4. Common typos
	typo_count = 0
	typo_examples = []
	for pattern, fix in COMMON_TYPOS.items():
		found = re.findall(pattern, text, re.IGNORECASE)
		if found:
			typo_count += len(found)
			typo_examples.append(f"{found[0]} -> {fix}")

	if typo_count > 0:
		penalties += min(typo_count * 3.0, 20.0)
		typos_str = ", ".join(typo_examples[:2])
		issues_detected.append(f"Common typographical errors ({typos_str})")
		template_parts.append("Common typographical errors ({typos})")
		params["typos"] = typos_str

	# 5. Long sentences
	sentences = re.split(r"[.!?]+(?:\s+|\n+)", text)
	long_sentences = [s for s in sentences if len(s.split()) > 40]
	if len(long_sentences) > 2:
		penalties += 10.0
		issues_detected.append(f"Found {len(long_sentences)} sentences that are too long (> 40 words)")
		template_parts.append("Found {long_sentence_count} sentences that are too long (> 40 words)")
		params["long_sentence_count"] = len(long_sentences)

	norm_factor = 100.0 / max(100, word_count)
	scaled_penalty = penalties * (norm_factor ** 0.5)

	final_score = max(20.0, min(100.0, 100.0 - scaled_penalty))

	if not issues_detected:
		final_reason = "Writing quality is very good (clean punctuation, capitalization, and structure)."
		final_template = final_reason
	else:
		final_reason = "; ".join(issues_detected) + "."
		final_template = "; ".join(template_parts) + "."

	return {
		"score": round(final_score, 1),
		"applicable": True,
		"reason": final_reason,
		"reason_template": final_template,
		"reason_params": json.dumps(params) if params else "{}",
		"word_count": word_count,
		"typo_count": typo_count,
		"typo_example": ", ".join(typo_examples[:2]),
	}
