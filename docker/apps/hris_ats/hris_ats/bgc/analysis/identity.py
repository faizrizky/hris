# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul analisis identitas murni (tanpa import frappe).
Menghitung skor kecocokan identitas (match_confidence) berbasis nama, konteks, dan keunikan.
"""

from __future__ import annotations

import re
from rapidfuzz import fuzz

TITLES = [
	"dr", "dra", "drs", "ir", "prof", "phd", "ph.d", "b.sc", "bsc", "m.sc", "msc",
	"s.kom", "skom", "s.t", "st", "s.e", "se", "s.h", "sh", "s.pd", "spd", "s.si", "ssi",
	"s.sos", "ssos", "s.ked", "sked", "m.kom", "mkom", "m.t", "mt", "m.m", "mm",
	"m.b.a", "mba", "m.si", "msi", "m.pd", "mpd", "m.h", "mh"
]

TITLES_REGEX = re.compile(r"\b(?:" + "|".join(re.escape(t) for t in TITLES) + r")\.?", re.IGNORECASE)


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

	# Urutkan unik
	seen = set()
	result = []
	for v in variants:
		if v and v not in seen:
			seen.add(v)
			result.append(v)
	return result


def calculate_match_confidence(
	candidate_name: str,
	candidate_variants: list[str],
	context_terms: list[str],
	text: str,
	total_hits: int = 10,
) -> tuple[int, list[str]]:
	"""Menghitung match_confidence (0-100) dan alasan kecocokan.

	Rumus:
	match_confidence = kemiripan_nama (0–50)
	                 + konteks_cocok   (0–40)
	                 + bonus_unik      (0–10)
	"""
	if not text or not candidate_name:
		return 0, ["Teks atau nama kosong"]

	clean_text = text.lower()
	clean_candidate = normalize_name(candidate_name)
	variants = [normalize_name(v) for v in (candidate_variants or [clean_candidate]) if v]
	if clean_candidate not in variants:
		variants.insert(0, clean_candidate)

	reasons = []

	# 1. Kemiripan nama (0-50)
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
		# Cari jendela kata yang memiliki kemiripan tertinggi
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
		reasons.append(f"Nama persis cocok (+50): '{matched_variant}'")
	elif best_ratio >= 90.0:
		name_score = 40
		reasons.append(f"Kemiripan nama tinggi {best_ratio:.0f}% (+40)")
	elif best_ratio >= 80.0:
		name_score = 25
		reasons.append(f"Kemiripan nama sedang {best_ratio:.0f}% (+25)")
	else:
		return 0, [f"Kemiripan nama {best_ratio:.0f}% di bawah ambang 80% (temuan dibuang)"]

	# 2. Konteks cocok (0-40): +15 per istilah dalam radius 300 karakter
	context_score = 0
	matched_context_terms = []

	# Temukan semua kemunculan nama di teks
	positions = []
	for v in variants:
		start = 0
		while True:
			idx = clean_text.find(v, start)
			if idx == -1:
				break
			positions.append((idx, idx + len(v)))
			start = idx + len(v)

	if not positions:
		# Fallback ke seluruh teks jika nama ditemukan lewat fuzz ratio
		positions = [(0, len(clean_text))]

	# Ekstrak radius 300 karakter di sekitar setiap posisi nama
	search_windows = []
	for p_start, p_end in positions:
		w_start = max(0, p_start - 300)
		w_end = min(len(clean_text), p_end + 300)
		search_windows.append(clean_text[w_start:w_end])

	combined_windows = " ".join(search_windows)

	clean_context_terms = [t.strip().lower() for t in context_terms if t and len(t.strip()) >= 2]
	for term in clean_context_terms:
		if term in combined_windows and term not in matched_context_terms:
			matched_context_terms.append(term)
			context_score += 15

	context_score = min(40, context_score)
	if matched_context_terms:
		reasons.append(f"Konteks cocok (+{context_score}): {', '.join(matched_context_terms)}")

	# 3. Bonus unik (0-10): +10 bila total_hits < 20 dan bukan mononim
	bonus_unik = 0
	if is_mononym(candidate_name):
		reasons.append("Mononim: tidak ada bonus keunikan nama (+0)")
	elif total_hits < 20:
		bonus_unik = 10
		reasons.append(f"Bonus nama unik {total_hits} hasil (+10)")

	total_confidence = min(100, name_score + context_score + bonus_unik)
	return total_confidence, reasons
