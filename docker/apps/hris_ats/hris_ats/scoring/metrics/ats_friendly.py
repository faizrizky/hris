# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 1: ATS friendly (0-100)
Mengevaluasi keramahan format CV terhadap sistem parser ATS:
- Teks dapat diekstrak tanpa error
- Minimal 3 bagian standar dikenali
- Email dan nomor telepon terbaca
- Tata letak satu kolom (bebas multi-kolom)
- Tidak ada tabel besar/rumit
- Panjang halaman ideal (1-3 halaman)
"""

from __future__ import annotations

import re
from typing import Any
from hris_ats.scoring.extract import ExtractionResult
from hris_ats.scoring.sections import count_recognized_sections


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	if extraction.is_scan or extraction.error or not extraction.normalized_text.strip():
		return {
			"score": 0.0,
			"applicable": True,
			"reason": extraction.error or "Teks CV tidak dapat dibaca atau diekstrak oleh parser ATS.",
		}

	reasons: list[str] = []
	score = 100.0

	# 1. Judul bagian standar (>= 3)
	sec_count = count_recognized_sections(sections)
	if sec_count < 3:
		score -= 20.0
		reasons.append("Kurang dari 3 judul bagian standar yang dikenali")

	# 2. Email dan telepon
	text = extraction.normalized_text
	has_email = bool(re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text))
	phone_pattern = r"(?:(?:\+62|62|0)8[1-9][\d\s\-]{6,12}\b|(?:\+62|62|0)(?:21|22|31|24|274)[\d\s\-]{6,10}\b|\+\d{1,3}[\s\-]?\d{3,5}[\s\-]?\d{4,8}\b)"
	has_phone = bool(re.search(phone_pattern, text))


	if not has_email and not has_phone:
		score -= 20.0
		reasons.append("Email dan nomor telepon tidak terbaca")
	elif not has_email:
		score -= 10.0
		reasons.append("Email tidak ditemukan")
	elif not has_phone:
		score -= 10.0
		reasons.append("Nomor telepon tidak ditemukan")

	# 3. Layout multi-kolom
	if extraction.is_multi_column:
		score -= 25.0
		reasons.append("Tata letak multi-kolom (dua kolom atau lebih) menyulitkan pembacaan urutan ATS")

	# 4. Tabel besar
	if extraction.table_count > 2:
		score -= 15.0
		reasons.append(f"Terdapat {extraction.table_count} tabel yang berpotensi memecah teks pada parser ATS")
	elif extraction.table_count > 0:
		score -= 5.0
		reasons.append("Terdapat tabel data")

	# 5. Panjang halaman (1-3 halaman ideal)
	if extraction.page_count > 3:
		score -= 15.0
		reasons.append(f"Panjang CV melebihi rekomendasi ({extraction.page_count} halaman, idealnya 1-3 halaman)")
	elif extraction.page_count == 0:
		score -= 20.0

	score = max(0.0, min(100.0, score))

	if not reasons:
		final_reason = "Format CV sangat ramah ATS (tata letak rapi, kontak dan bagian utama lengkap)."
	else:
		final_reason = "; ".join(reasons) + "."

	return {
		"score": round(score, 1),
		"applicable": True,
		"reason": final_reason,
	}
