# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pemecah bagian CV berdasarkan judul standar dalam Bahasa Indonesia dan Bahasa Inggris.
"""

from __future__ import annotations

import re

SECTION_PATTERNS = {
	"summary": [
		r"ringkasan\s+profesional",
		r"ringkasan",
		r"tentang\s+saya",
		r"profil\s+profesional",
		r"profil",
		r"professional\s+summary",
		r"summary",
		r"about\s+me",
		r"career\s+objective",
		r"objective",
		r"profile",
	],
	"experience": [
		r"pengalaman\s+profesional",
		r"pengalaman\s+kerja",
		r"riwayat\s+pekerjaan",
		r"riwayat\s+kerja",
		r"pengalaman",
		r"professional\s+experience",
		r"work\s+experience",
		r"employment\s+history",
		r"career\s+history",
		r"experience",
	],
	"education": [
		r"riwayat\s+pendidikan",
		r"latar\s+belakang\s+pendidikan",
		r"pendidikan",
		r"educational\s+background",
		r"academic\s+background",
		r"education",
	],
	"skills": [
		r"keahlian\s+teknis",
		r"keahlian",
		r"keterampilan",
		r"kemampuan",
		r"technical\s+skills",
		r"core\s+competencies",
		r"competencies",
		r"skills",
		r"skill",
	],
	"certifications": [
		r"lisensi\s*(?:&|dan)\s*sertifikasi",
		r"sertifikasi",
		r"sertifikat",
		r"lisensi",
		r"licenses\s*(?:&|and)\s*certifications",
		r"certifications",
		r"certification",
		r"certificates",
		r"licenses",
	],
	"achievements": [
		r"prestasi\s*(?:&|dan)\s*penghargaan",
		r"penghargaan",
		r"prestasi",
		r"awards\s*(?:&|and)\s*honors",
		r"achievements",
		r"achievement",
		r"awards",
		r"honors",
	],
}


def _build_header_regex() -> re.Pattern:
	"""Bangun regex gabungan untuk mendeteksi baris judul bagian."""
	all_phrases = []
	for sec, patterns in SECTION_PATTERNS.items():
		for p in patterns:
			all_phrases.append(f"(?P<{sec}_{len(all_phrases)}>{p})")
	pattern_str = r"^[ \t]*(?:[•\-#*]+\s*)?(?:" + "|".join(all_phrases) + r")(?:\s*[:|\-])?[ \t]*$"
	return re.compile(pattern_str, re.IGNORECASE | re.MULTILINE)


HEADER_REGEX = _build_header_regex()


def split_sections(text: str) -> dict[str, str]:
	"""Pecah teks CV menjadi kamus bagian:
	{
	    'header': '...',       # nama, kontak, bio awal sebelum judul pertama
	    'summary': '...',
	    'experience': '...',
	    'education': '...',
	    'skills': '...',
	    'certifications': '...',
	    'achievements': '...',
	    'other': '...',
	}
	"""
	if not text:
		return {
			"header": "",
			"summary": "",
			"experience": "",
			"education": "",
			"skills": "",
			"certifications": "",
			"achievements": "",
			"other": "",
		}

	lines = text.split("\n")
	sections: dict[str, list[str]] = {
		"header": [],
		"summary": [],
		"experience": [],
		"education": [],
		"skills": [],
		"certifications": [],
		"achievements": [],
		"other": [],
	}

	current_section = "header"

	for line in lines:
		stripped = line.strip()
		if not stripped:
			sections[current_section].append(line)
			continue

		# Periksa apakah baris ini adalah judul bagian
		match = HEADER_REGEX.match(stripped)
		if match:
			# Temukan nama bagian dari group yang cocok
			matched_group = [k for k, v in match.groupdict().items() if v]
			if matched_group:
				group_key = matched_group[0]
				sec_name = group_key.split("_")[0]
				current_section = sec_name
				continue

		sections[current_section].append(line)

	return {k: "\n".join(v).strip() for k, v in sections.items()}


def count_recognized_sections(sections: dict[str, str]) -> int:
	"""Hitung berapa banyak bagian standar yang berhasil ditemukan dan tidak kosong."""
	standard_keys = ["summary", "experience", "education", "skills", "certifications", "achievements"]
	return sum(1 for k in standard_keys if sections.get(k, "").strip())
