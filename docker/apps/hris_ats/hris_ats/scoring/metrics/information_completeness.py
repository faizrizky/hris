# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 4: Information completeness (0-100)
Bobot cek kelengkapan data:
- Nama pelamar: 15
- Email: 20
- Nomor telepon: 20
- Domisili / Lokasi: 10
- Bagian pendidikan: 15
- Bagian pengalaman: 15
- Bagian keahlian: 5
Total: 100 poin.
"""

from __future__ import annotations

import re
from typing import Any
from hris_ats.scoring.extract import ExtractionResult

DOMICILE_KEYWORDS = [
	"jakarta", "surabaya", "bandung", "medan", "semarang", "makassar",
	"palembang", "tangerang", "depok", "bekasi", "bogor", "yogyakarta",
	"malang", "surakarta", "solo", "pekanbaru", "denpasar", "bali",
	"indonesia", "domisili", "address", "alamat", "location", "tinggal",
	"residence", "city", "provinsi"
]


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	text = extraction.normalized_text
	header_text = sections.get("header", "") or text[:500]

	score = 0.0
	missing: list[str] = []

	# 1. Nama (15)
	# Header minimal 2 kata dan tidak kosong
	candidate_name = (criteria or {}).get("applicant_name", "")
	if candidate_name and candidate_name.lower() in text.lower():
		score += 15.0
	elif len(header_text.split("\n")[0].split()) >= 2:
		score += 15.0
	else:
		missing.append("Nama pelamar tidak terdeteksi dengan jelas")

	# 2. Email (20)
	has_email = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text))
	if has_email:
		score += 20.0
	else:
		missing.append("Email tidak ditemukan")

	# 3. Telepon (20)
	phone_pattern = r"(?:(?:\+62|62|0)8[1-9][\d\s\-]{6,12}\b|(?:\+62|62|0)(?:21|22|31|24|274)[\d\s\-]{6,10}\b|\+\d{1,3}[\s\-]?\d{3,5}[\s\-]?\d{4,8}\b)"
	has_phone = bool(re.search(phone_pattern, text))
	if has_phone:
		score += 20.0
	else:
		missing.append("Nomor telepon tidak ditemukan")


	# 4. Domisili / Lokasi (10)
	has_domicile = any(k in text.lower() for k in DOMICILE_KEYWORDS)
	if has_domicile:
		score += 10.0
	else:
		missing.append("Domisili/lokasi tempat tinggal tidak dicantumkan")

	# 5. Bagian pendidikan (15)
	if len(sections.get("education", "").strip()) > 10:
		score += 15.0
	else:
		missing.append("Bagian riwayat pendidikan tidak ditemukan")

	# 6. Bagian pengalaman (15)
	if len(sections.get("experience", "").strip()) > 10:
		score += 15.0
	else:
		missing.append("Bagian pengalaman kerja tidak ditemukan")

	# 7. Bagian keahlian (5)
	if len(sections.get("skills", "").strip()) > 5:
		score += 5.0
	else:
		missing.append("Bagian keahlian (skills) tidak ditemukan")

	if not missing:
		final_reason = "Informasi pelamar lengkap (nama, kontak, domisili, pendidikan, pengalaman, skill)."
	else:
		final_reason = "; ".join(missing) + "."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
	}
