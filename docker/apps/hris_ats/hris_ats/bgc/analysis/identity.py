# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul analisis identitas murni (tanpa import frappe).
Menghitung skor kecocokan identitas (match_confidence) berbasis nama, konteks, dan keunikan,
serta kecocokan akun platform profil publik (identity_match).
"""

from __future__ import annotations

import re
from rapidfuzz import fuzz
from hris_ats.i18n import LocalizedText

TITLES = [
	"dr", "dra", "drs", "ir", "prof", "phd", "ph.d", "b.sc", "bsc", "m.sc", "msc",
	"s.kom", "skom", "s.t", "st", "s.e", "se", "s.h", "sh", "s.pd", "spd", "s.si", "ssi",
	"s.sos", "ssos", "s.ked", "sked", "m.kom", "mkom", "m.t", "mt", "m.m", "mm",
	"m.b.a", "mba", "m.si", "msi", "m.pd", "mpd", "m.h", "mh"
]

TITLES_REGEX = re.compile(r"\b(?:" + "|".join(re.escape(t) for t in TITLES) + r")\.?", re.IGNORECASE)
NIK_REGEX = re.compile(r"\b\d{16}\b")


def normalize_name(name: str) -> str:
	"""Normalisasi nama: huruf kecil, hapus gelar akademik/kehormatan, tanda baca, satukan spasi."""
	if not name:
		return ""
	cleaned = TITLES_REGEX.sub(" ", name.lower())
	cleaned = re.sub(r"[^\w\s]", " ", cleaned)
	return " ".join(cleaned.split())


def is_mononym(name: str) -> bool:
	"""Deteksi apakah nama hanya terdiri dari satu kata (mononim)."""
	clean = normalize_name(name)
	return len(clean.split()) <= 1


def generate_name_variants(name: str) -> list[str]:
	"""Membuat variasi nama pencarian: nama lengkap, nama depan + belakang, tanpa nama tengah."""
	clean = normalize_name(name)
	words = clean.split()
	if not words:
		return []

	variants = [clean]
	if len(words) > 2:
		variants.append(f"{words[0]} {words[-1]}")
		# Variasi tanpa nama tengah ke-1 bila panjang
		if len(words) == 3:
			variants.append(f"{words[0]} {words[1]}")
	elif len(words) == 2:
		variants.append(f"{words[0]} {words[1]}")

	seen = set()
	result = []
	for v in variants:
		if v and v not in seen:
			seen.add(v)
			result.append(v)
	return result


def calculate_match_confidence(
	candidate_name: str,
	candidate_variants: list[str] | None,
	context_terms: list[str] | None,
	text: str,
	total_hits: int = 10,
	text_source: str = "Teks lengkap",
	extra_context: list[str] | None = None,
	return_excerpt: bool = False,
) -> tuple[int, list[str]] | tuple[int, list[str], str]:
	"""Menghitung match_confidence (0-100) dan alasan kecocokan sesuai spesifikasi 6.2.

	Rumus:
	match_confidence = kemiripan_nama (0–50)
	                 + konteks_cocok   (0–40)
	                 + bonus_unik      (0–10)

	Aturan:
	- Urutan prioritas teks: PDF putusan -> Teks lengkap -> Cuplikan.
	- Bila text_source == 'Cuplikan', skor dibatasi maksimal 70.
	- Bila nama muncul beberapa kali di teks, konteks_cocok dihitung di kemunculan
	  dengan konteks terbanyak, dan potongan teks di sekitarnya disimpan sebagai evidence_excerpt.
	"""
	if not text or not candidate_name:
		reasons = [LocalizedText("Empty text or name", "Empty text or name")]
		return (0, reasons, "") if return_excerpt else (0, reasons)

	clean_text = text.lower()
	clean_candidate = normalize_name(candidate_name)
	raw_variants = candidate_variants or [clean_candidate]
	variants = [normalize_name(v) for v in raw_variants if v]
	if clean_candidate not in variants:
		variants.insert(0, clean_candidate)

	reasons: list[str] = []

	# 1. Name similarity (0-50)
	best_ratio = 0.0
	matched_variant = ""
	is_exact_in_text = False

	for v in variants:
		if v in clean_text:
			is_exact_in_text = True
			best_ratio = 100.0
			matched_variant = v
			break

	if not is_exact_in_text:
		target_word_len = len(clean_candidate.split())
		text_words = clean_text.split()
		for i in range(max(1, len(text_words) - target_word_len + 1)):
			window = " ".join(text_words[i : i + target_word_len + 1])
			for v in variants:
				ratio = fuzz.token_sort_ratio(v, window)
				if ratio > best_ratio:
					best_ratio = ratio
					matched_variant = v

	if is_exact_in_text or best_ratio >= 99.0:
		name_score = 50
		reasons.append(
			LocalizedText(
				f"Exact name match (+50): '{matched_variant}'",
				"Exact name match (+50): '{name}'",
				{"name": matched_variant},
			)
		)
	elif best_ratio >= 90.0:
		name_score = 40
		ratio_str = f"{best_ratio:.0f}"
		reasons.append(
			LocalizedText(
				f"High name similarity {ratio_str}% (+40)",
				"High name similarity {ratio}% (+40)",
				{"ratio": ratio_str},
			)
		)
	elif best_ratio >= 80.0:
		name_score = 25
		ratio_str = f"{best_ratio:.0f}"
		reasons.append(
			LocalizedText(
				f"Moderate name similarity {ratio_str}% (+25)",
				"Moderate name similarity {ratio}% (+25)",
				{"ratio": ratio_str},
			)
		)
	else:
		ratio_str = f"{best_ratio:.0f}"
		fail_reasons = [
			LocalizedText(
				f"Name similarity {ratio_str}% below 80% threshold (finding discarded)",
				"Name similarity {ratio}% below 80% threshold (finding discarded)",
				{"ratio": ratio_str},
			)
		]
		return (0, fail_reasons, "") if return_excerpt else (0, fail_reasons)

	# Gabungkan context_terms dan extra_context (mis. pekerjaan dan kota dari PDF)
	combined_context_pool: list[str] = []
	for raw_list in (context_terms, extra_context):
		if raw_list:
			for item in raw_list:
				if isinstance(item, str):
					clean_term = item.strip().lower()
					if len(clean_term) >= 2 and clean_term not in combined_context_pool:
						combined_context_pool.append(clean_term)

	# 2. Temukan semua kemunculan nama untuk memilih kemunculan dengan konteks terbanyak
	positions: list[tuple[int, int]] = []
	for v in variants:
		start = 0
		while True:
			idx = clean_text.find(v, start)
			if idx == -1:
				break
			positions.append((idx, idx + len(v)))
			start = idx + len(v)

	if not positions:
		positions = [(0, min(len(clean_text), 100))]

	best_occurrence_terms: list[str] = []
	best_pos = positions[0]

	for p_start, p_end in positions:
		w_start = max(0, p_start - 300)
		w_end = min(len(clean_text), p_end + 300)
		win_text = clean_text[w_start:w_end]

		occurrence_terms: list[str] = []
		for term in combined_context_pool:
			if term in win_text and term not in occurrence_terms:
				occurrence_terms.append(term)

		if len(occurrence_terms) > len(best_occurrence_terms):
			best_occurrence_terms = occurrence_terms
			best_pos = (p_start, p_end)

	context_score = min(40, len(best_occurrence_terms) * 15)
	if best_occurrence_terms:
		terms_str = ", ".join(best_occurrence_terms)
		reasons.append(
			LocalizedText(
				f"Context matched (+{context_score}): {terms_str}",
				"Context matched (+{score}): {terms}",
				{"score": context_score, "terms": terms_str},
			)
		)

	# Extract evidence excerpt (max 600 chars) around best occurrence
	best_start, best_end = best_pos
	exc_start = max(0, best_start - 150)
	exc_end = min(len(text), best_end + 450)
	evidence_excerpt = text[exc_start:exc_end].strip()
	if len(evidence_excerpt) > 600:
		evidence_excerpt = evidence_excerpt[:600]

	# Redact 16-digit NIK for privacy protection
	evidence_excerpt = NIK_REGEX.sub("[NIK DIREDAKSI]", evidence_excerpt)

	# 3. Unique name bonus (0-10): +10 when total_hits < 20 and not a mononym
	bonus_unik = 0
	if is_mononym(candidate_name):
		reasons.append(
			LocalizedText(
				"Mononym: no unique name bonus (+0)",
				"Mononym: no unique name bonus (+0)",
			)
		)
	elif total_hits < 20:
		bonus_unik = 10
		reasons.append(
			LocalizedText(
				f"Unique name bonus {total_hits} results (+10)",
				"Unique name bonus {hits} results (+10)",
				{"hits": total_hits},
			)
		)

	total_confidence = min(100, name_score + context_score + bonus_unik)

	# Cap snippet-only score at 70 (spec 6.2)
	if text_source.strip().lower() in ("cuplikan", "snippet") and total_confidence > 70:
		total_confidence = 70
		reasons.append(
			LocalizedText(
				"Score from snippet only capped at 70",
				"Score from snippet only capped at 70",
			)
		)

	if return_excerpt:
		return total_confidence, reasons, evidence_excerpt
	return total_confidence, reasons


def evaluate_match_with_excerpt(
	candidate_name: str,
	candidate_variants: list[str] | None,
	context_terms: list[str] | None,
	text: str,
	total_hits: int = 10,
	text_source: str = "Full text",
	extra_context: list[str] | None = None,
) -> tuple[int, list[str], str]:
	"""Convenience function returning (match_confidence, match_reasons, evidence_excerpt)."""
	res = calculate_match_confidence(
		candidate_name=candidate_name,
		candidate_variants=candidate_variants,
		context_terms=context_terms,
		text=text,
		total_hits=total_hits,
		text_source=text_source,
		extra_context=extra_context,
		return_excerpt=True,
	)
	return res  # type: ignore[return-value]


def calculate_account_identity_match(
	candidate_name: str,
	candidate_variants: list[str] | None,
	candidate_city: str | None,
	candidate_cv_terms: list[str] | None,
	display_name: str | None,
	bio: str | None,
	location: str | None,
	declared_by_candidate: bool = False,
	is_forbidden: bool = False,
) -> tuple[int | None, list[str]]:
	"""Calculates public platform account identity match (0-100) according to 6.2.1."""
	if is_forbidden:
		return None, []

	reasons: list[str] = []

	# 1. Display name similarity (0-50)
	name_score = 0
	clean_display = normalize_name(display_name or "")
	clean_cand = normalize_name(candidate_name or "")
	all_variants = [normalize_name(v) for v in (candidate_variants or []) if v]
	if clean_cand and clean_cand not in all_variants:
		all_variants.insert(0, clean_cand)

	if clean_display and all_variants:
		best_ratio = 0.0
		best_v = ""
		for v in all_variants:
			ratio = fuzz.token_sort_ratio(v, clean_display)
			if ratio > best_ratio:
				best_ratio = ratio
				best_v = v

		if clean_display == clean_cand or best_ratio >= 99.0:
			name_score = 50
			reasons.append(
				LocalizedText(
					f"Exact display name match (+50): '{display_name}'",
					"Exact display name match (+50): '{name}'",
					{"name": display_name},
				)
			)
		elif best_ratio >= 90.0:
			name_score = 40
			ratio_str = f"{best_ratio:.0f}"
			reasons.append(
				LocalizedText(
					f"High display name similarity {ratio_str}% (+40)",
					"High display name similarity {ratio}% (+40)",
					{"ratio": ratio_str},
				)
			)
		elif best_ratio >= 80.0:
			name_score = 25
			ratio_str = f"{best_ratio:.0f}"
			reasons.append(
				LocalizedText(
					f"Moderate display name similarity {ratio_str}% (+25)",
					"Moderate display name similarity {ratio}% (+25)",
					{"ratio": ratio_str},
				)
			)
		else:
			ratio_str = f"{best_ratio:.0f}"
			reasons.append(
				LocalizedText(
					f"Low display name similarity {ratio_str}% (+0)",
					"Low display name similarity {ratio}% (+0)",
					{"ratio": ratio_str},
				)
			)
	else:
		reasons.append(
			LocalizedText(
				"Display name not available (+0)",
				"Display name not available (+0)",
			)
		)

	# 2. Location matches candidate city (0-20)
	loc_score = 0
	clean_loc = (location or "").strip().lower()
	clean_city = (candidate_city or "").strip().lower()

	if clean_city and clean_loc and (clean_city in clean_loc or clean_loc in clean_city):
		loc_score = 20
		reasons.append(
			LocalizedText(
				f"Profile location matches candidate city '{candidate_city}' (+20)",
				"Profile location matches candidate city '{city}' (+20)",
				{"city": candidate_city},
			)
		)
	elif clean_city and clean_loc:
		reasons.append(
			LocalizedText(
				f"Profile location '{location}' differs from candidate city (+0)",
				"Profile location '{location}' differs from candidate city (+0)",
				{"location": location},
			)
		)

	# 3. Bio mentions CV entity (0-20)
	bio_score = 0
	clean_bio = (bio or "").strip().lower()
	matched_cv_term = ""

	if clean_bio and candidate_cv_terms:
		for term in candidate_cv_terms:
			if not term or not isinstance(term, str):
				continue
			ct = term.strip().lower()
			if len(ct) >= 3 and ct in clean_bio:
				matched_cv_term = term.strip()
				break

	if matched_cv_term:
		bio_score = 20
		reasons.append(
			LocalizedText(
				f"Bio mentions CV entity '{matched_cv_term}' (+20)",
				"Bio mentions CV entity '{term}' (+20)",
				{"term": matched_cv_term},
			)
		)

	# 4. Account declared by candidate (+10)
	declared_score = 0
	if declared_by_candidate:
		declared_score = 10
		reasons.append(
			LocalizedText(
				"Account self-declared by candidate (+10)",
				"Account self-declared by candidate (+10)",
			)
		)

	total_score = min(100, name_score + loc_score + bio_score + declared_score)
	return total_score, reasons
