# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul pembuatan ringkasan profil otomatis murni (tanpa import frappe).
Menyusun paragraf faktual sesuai templat bagian 6.7 SPEC-BACKGROUND-CHECK.md,
dengan menghilangkan klausa bernilai nol.
"""

from __future__ import annotations

from typing import Any


def generate_automated_summary(
	candidate_name: str,
	job_title: str,
	accounts: list[str] | list[dict[str, Any]] | None = None,
	article_count: int = 0,
	achievement_count: int = 0,
	case_count: int = 0,
	posts_count: int = 0,
	politeness_score: int = 100,
	risk_posts_count: int = 0,
) -> str:
	"""Menyusun teks ringkasan otomatis profil kandidat berdasarkan data faktual."""
	name = candidate_name or "Kandidat"
	title = job_title or "posisi yang dilamar"

	sentences = []

	# Kalimat 1: Pengantar lamaran
	sentences.append(f"{name} melamar sebagai {title}.")

	# Kalimat 2: Akun publik
	platform_list = []
	if accounts:
		for a in accounts:
			if isinstance(a, str):
				platform_list.append(a)
			elif isinstance(a, dict) and a.get("platform"):
				platform_list.append(a["platform"])

	if platform_list:
		p_str = ", ".join(sorted(set(platform_list)))
		sentences.append(f"Ditemukan {len(platform_list)} akun publik ({p_str}).")

	# Kalimat 3: Artikel & prestasi
	if article_count > 0:
		if achievement_count > 0:
			sentences.append(
				f"Ada {article_count} artikel yang kemungkinan besar terkait, {achievement_count} di antaranya tentang prestasi."
			)
		else:
			sentences.append(f"Ada {article_count} artikel yang kemungkinan besar terkait.")

	# Kalimat 4: Catatan perkara hukum
	if case_count > 0:
		sentences.append(f"Ditemukan {case_count} catatan perkara yang perlu diverifikasi.")

	# Kalimat 5: Analisis post media sosial
	if posts_count > 0:
		if risk_posts_count > 0:
			sentences.append(
				f"Analisis {posts_count} post menunjukkan kesantunan bahasa {politeness_score}/100 dan {risk_posts_count} post yang ditandai berisiko."
			)
		else:
			sentences.append(
				f"Analisis {posts_count} post menunjukkan kesantunan bahasa {politeness_score}/100 tanpa post yang terindikasi berisiko."
			)

	# Jika tidak ada temuan apa pun selain lamaran
	if len(sentences) == 1:
		sentences.append("Tidak ditemukan catatan perkara khusus atau temuan risiko signifikan pada pemeriksaan awal.")

	return " ".join(sentences)
