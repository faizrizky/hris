# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Metrik 3: Date consistency (0-100)
Mengevaluasi konsistensi dan kewajaran penanggalan:
- Satu format tanggal dominan (>= 80%)
- Tanggal mulai <= tanggal selesai
- Tidak ada tanggal di masa depan
- Urutan kronologis pekerjaan
- Deteksi tanggal tumpang tindih antar jabatan (penalti ringan + dicatat di reason)
- Celah karier > 12 bulan dicatat di alasan (tanpa penalti skor)
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from hris_ats.scoring.extract import ExtractionResult

MONTH_MAP = {
	"jan": 1, "januari": 1, "january": 1,
	"feb": 2, "februari": 2, "february": 2,
	"mar": 3, "maret": 3, "march": 3,
	"apr": 4, "april": 4,
	"mei": 5, "may": 5,
	"jun": 6, "juni": 6, "june": 6,
	"jul": 7, "juli": 7, "july": 7,
	"agu": 8, "agustus": 8, "aug": 8, "august": 8,
	"sep": 9, "september": 9,
	"okt": 10, "oktober": 10, "oct": 10, "october": 10,
	"nov": 11, "november": 11,
	"des": 12, "desember": 12, "dec": 12, "december": 12,
}

NOW_YEAR = datetime.now().year
NOW_MONTH = datetime.now().month


def parse_date_token(token: str) -> tuple[int, int] | None:
	"""Mengubah token tanggal string menjadi tuple (year, month)."""
	token = token.strip().lower()
	if token in ("sekarang", "present", "current", "saat ini"):
		return (NOW_YEAR, NOW_MONTH)

	# Format: Bulan Tahun (e.g. Jan 2021, Januari 2021)
	m_name = re.match(r"^([a-z]+)\s+(\d{4})$", token)
	if m_name:
		name, yr = m_name.groups()
		month = MONTH_MAP.get(name)
		if month:
			return (int(yr), month)

	# Format: MM/YYYY atau MM-YYYY
	m_slash = re.match(r"^(\d{1,2})[/\-](\d{4})$", token)
	if m_slash:
		mo, yr = m_slash.groups()
		mo_int = int(mo)
		if 1 <= mo_int <= 12:
			return (int(yr), mo_int)

	# Format: YYYY saja
	m_yr = re.match(r"^(\d{4})$", token)
	if m_yr:
		return (int(m_yr.group(1)), 1)

	return None


def extract_date_ranges(text: str) -> list[dict[str, Any]]:
	"""Mengekstrak rentang tanggal (start, end) beserta teks baris/konteks."""
	results = []
	# Pola rentang tanggal: "Start - End" atau "Start s/d End" atau "Start to End"
	range_pattern = re.compile(
		r"((?:[a-zA-Z]+|\d{1,2}[/\-])?\s*\d{4})\s*(?:-|–|—|to|s/d|sampai)\s*((?:[a-zA-Z]+\s+)?\d{4}|sekarang|present|current|saat ini)",
		re.IGNORECASE,
	)

	for match in range_pattern.finditer(text):
		start_raw, end_raw = match.groups()
		p_start = parse_date_token(start_raw)
		p_end = parse_date_token(end_raw)

		# Format classification
		fmt = "year_only"
		if re.search(r"[a-zA-Z]+", start_raw):
			fmt = "month_name"
		elif "/" in start_raw or "-" in start_raw:
			fmt = "numeric_month"

		if p_start and p_end:
			# Ambil konteks di sekitar rentang (mis. nama jabatan/perusahaan di baris yang sama)
			start_idx = max(0, match.start() - 100)
			end_idx = min(len(text), match.end() + 100)
			context = text[start_idx:end_idx]

			results.append({
				"start": p_start,
				"end": p_end,
				"format": fmt,
				"raw_start": start_raw.strip(),
				"raw_end": end_raw.strip(),
				"context": context,
			})

	return results


def evaluate(extraction: ExtractionResult, sections: dict[str, str], criteria: dict[str, Any] | None = None) -> dict[str, Any]:
	text = extraction.normalized_text
	exp_text = sections.get("experience", "") or text
	ranges = extract_date_ranges(exp_text)

	if not ranges:
		# Jika tidak ada rentang di experience, cari di seluruh dokumen
		ranges = extract_date_ranges(text)

	if not ranges:
		return {
			"score": 60.0,
			"applicable": True,
			"reason": "Rentang tanggal pekerjaan tidak ditemukan atau format tidak terbaca.",
		}

	reasons: list[str] = []
	penalties = 0.0

	# 1. Konsistensi format (>= 80% harus satu format dominan)
	formats = [r["format"] for r in ranges]
	if formats:
		most_common_count = max(formats.count(f) for f in set(formats))
		ratio = most_common_count / len(formats)
		if ratio < 0.8:
			penalties += 15.0
			reasons.append("Format tanggal campuran (terdapat format berbeda, mis. nama bulan dan angka)")

	# 2. Mulai <= Selesai
	invalid_range_count = 0
	for r in ranges:
		sy, sm = r["start"]
		ey, em = r["end"]
		if (sy > ey) or (sy == ey and sm > em):
			invalid_range_count += 1

	if invalid_range_count > 0:
		penalties += min(invalid_range_count * 15.0, 30.0)
		reasons.append(f"Terdapat {invalid_range_count} rentang di mana tanggal mulai lebih akhir dari tanggal selesai")

	# 3. Tanggal di masa depan
	future_dates = 0
	for r in ranges:
		sy, sm = r["start"]
		ey, em = r["end"]
		# Tanggal lebih dari 1 bulan dari sekarang
		if sy > NOW_YEAR or (sy == NOW_YEAR and sm > (NOW_MONTH + 1)):
			future_dates += 1
		if ey > NOW_YEAR or (ey == NOW_YEAR and em > (NOW_MONTH + 1)):
			future_dates += 1

	if future_dates > 0:
		penalties += 20.0
		reasons.append("Terdapat tanggal pekerjaan di masa depan")

	# 4. Deteksi pekerjaan yang tanggalnya tumpang tindih antar jabatan
	overlaps: list[str] = []
	sorted_ranges = sorted(ranges, key=lambda x: (x["start"][0], x["start"][1]))

	for i in range(len(sorted_ranges)):
		for j in range(i + 1, len(sorted_ranges)):
			r1 = sorted_ranges[i]
			r2 = sorted_ranges[j]
			s1, e1 = r1["start"], r1["end"]
			s2, e2 = r2["start"], r2["end"]

			# Cek tumpang tindih jika s2 < e1 (lebih dari 1 bulan)
			overlap_months = (e1[0] - s2[0]) * 12 + (e1[1] - s2[1])
			if overlap_months > 1:
				overlaps.append(f"{r1['raw_start']}-{r1['raw_end']} dengan {r2['raw_start']}-{r2['raw_end']}")

	if overlaps:
		penalties += 10.0  # Penalti ringan sesuai spesifikasi
		reasons.append(f"Tanggal jabatan tumpang tindih ({overlaps[0]})")

	# 5. Cek celah karier > 12 bulan (hanya dicatat, tidak mengurangi skor)
	has_gap = False
	for i in range(len(sorted_ranges) - 1):
		cur_end = sorted_ranges[i]["end"]
		next_start = sorted_ranges[i + 1]["start"]
		gap_months = (next_start[0] - cur_end[0]) * 12 + (next_start[1] - cur_end[1])
		if gap_months > 12:
			has_gap = True
			break

	if has_gap:
		reasons.append("Terdapat celah karier > 12 bulan (informasi)")

	final_score = max(0.0, min(100.0, 100.0 - penalties))

	if not reasons:
		final_reason = "Format tanggal sangat konsisten dan urutan kronologis rapi."
	else:
		final_reason = "; ".join(reasons) + "."

	return {
		"score": round(final_score, 1),
		"applicable": True,
		"reason": final_reason,
	}
