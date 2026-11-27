# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Ekstraksi teks CV murni (tanpa import frappe).
Mendukung format PDF (via pdfplumber) dan DOCX (via zipfile + xml.etree).
Mendeteksi PDF scan jika teks per halaman < min_text_chars_per_page.
"""

from __future__ import annotations

import os
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from typing import Any


@dataclass
class PageData:
	page_number: int
	text: str
	char_count: int
	word_count: int
	is_multi_column: bool = False
	table_count: int = 0


@dataclass
class ExtractionResult:
	raw_text: str
	normalized_text: str
	page_count: int
	pages: list[PageData] = field(default_factory=list)
	is_scan: bool = False
	is_multi_column: bool = False
	table_count: int = 0
	error: str | None = None
	file_type: str = ""


def normalize_text(text: str) -> str:
	"""Normalisasi teks untuk pencocokan:
	- Normalisasi Unicode NFKC
	- Ganti spasi non-breaking dan tab dengan spasi biasa
	- Satukan pemisahan kata akibat tanda hubung di akhir baris (e.g., 'organi-\\nzation' -> 'organization')
	- Rapikan spasi berlebih
	"""
	if not text:
		return ""
	normalized = unicodedata.normalize("NFKC", text)
	normalized = normalized.replace("\xa0", " ").replace("\r\n", "\n").replace("\r", "\n")
	# Satukan tanda hubung di akhir baris
	normalized = re.sub(r"(\w+)-\n(\w+)", r"\1\2", normalized)
	# Satukan baris tapi pertahankan paragraf ganda jika ada
	lines = [re.sub(r"[ \t]+", " ", line).strip() for line in normalized.split("\n")]
	return "\n".join(lines).strip()


def extract_docx(file_path: str) -> ExtractionResult:
	"""Ekstraksi teks dari file DOCX via zipfile dan XML ElementTree bawaan Python."""
	try:
		with zipfile.ZipFile(file_path, "r") as zf:
			if "word/document.xml" not in zf.namelist():
				return ExtractionResult(
					raw_text="",
					normalized_text="",
					page_count=0,
					error="File DOCX tidak valid (tidak ada word/document.xml).",
					file_type="docx",
				)
			xml_content = zf.read("word/document.xml")

		tree = ET.fromstring(xml_content)
		namespaces = {
			"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
		}

		paragraphs: list[str] = []
		table_count = len(tree.findall(".//w:tbl", namespaces))

		for p in tree.findall(".//w:p", namespaces):
			texts = [node.text for node in p.findall(".//w:t", namespaces) if node.text]
			if texts:
				paragraphs.append("".join(texts))

		full_text = "\n".join(paragraphs)
		norm_text = normalize_text(full_text)

		# DOCX tidak membagi halaman secara tegas; estimasi 1 halaman per ~2000 karakter (min 1)
		est_pages = max(1, (len(norm_text) + 1999) // 2000)
		pages = [PageData(page_number=1, text=norm_text, char_count=len(norm_text), word_count=len(norm_text.split()), table_count=table_count)]

		return ExtractionResult(
			raw_text=full_text,
			normalized_text=norm_text,
			page_count=est_pages,
			pages=pages,
			is_scan=False,
			is_multi_column=False,
			table_count=table_count,
			file_type="docx",
		)
	except Exception as exc:
		return ExtractionResult(
			raw_text="",
			normalized_text="",
			page_count=0,
			error=f"Gagal membaca file DOCX: {exc}",
			file_type="docx",
		)


def _detect_multi_column(words: list[dict[str, Any]], page_width: float) -> bool:
	"""Deteksi apakah kata-kata pada halaman mengelompok ke >= 2 kolom terpisah."""
	if not words or page_width <= 0:
		return False

	mid_x = page_width / 2.0
	margin = page_width * 0.08  # 8% gutter sekitar garis tengah
	left_col_words = [w for w in words if w.get("x1", 0) < (mid_x - margin / 2)]
	right_col_words = [w for w in words if w.get("x0", 0) > (mid_x + margin / 2)]

	total_words = len(words)
	if total_words < 30:
		return False

	# Jika kedua sisi tengah masing-masing memuat >= 25% dari total kata
	left_ratio = len(left_col_words) / total_words
	right_ratio = len(right_col_words) / total_words

	return left_ratio >= 0.25 and right_ratio >= 0.25


def extract_pdf(file_path: str, min_text_chars_per_page: int = 200) -> ExtractionResult:
	"""Ekstraksi teks dari file PDF via pdfplumber."""
	try:
		import pdfplumber
	except ImportError:
		return ExtractionResult(
			raw_text="",
			normalized_text="",
			page_count=0,
			error="Modul pdfplumber tidak ditemukan.",
			file_type="pdf",
		)

	try:
		pages_data: list[PageData] = []
		all_page_texts: list[str] = []
		total_tables = 0
		multi_column_pages = 0

		with pdfplumber.open(file_path) as pdf:
			page_count = len(pdf.pages)
			if page_count == 0:
				return ExtractionResult(
					raw_text="",
					normalized_text="",
					page_count=0,
					error="File PDF kosong (0 halaman).",
					file_type="pdf",
				)

			for idx, page in enumerate(pdf.pages, start=1):
				page_text = page.extract_text() or ""
				all_page_texts.append(page_text)
				char_count = len(page_text.strip())
				word_count = len(page_text.split())

				# Deteksi tabel
				tables = page.find_tables() or []
				table_count = len(tables)
				total_tables += table_count

				# Deteksi multi-kolom
				words = page.extract_words() or []
				is_multi = _detect_multi_column(words, float(page.width or 0))
				if is_multi:
					multi_column_pages += 1

				pages_data.append(
					PageData(
						page_number=idx,
						text=page_text,
						char_count=char_count,
						word_count=word_count,
						is_multi_column=is_multi,
						table_count=table_count,
					)
				)

		full_text = "\n\n".join(all_page_texts)
		norm_text = normalize_text(full_text)

		# Deteksi scan: jika rata-rata karakter per halaman < min_text_chars_per_page
		# atau jika sebagian besar halaman tidak memiliki teks yang cukup
		total_chars = sum(p.char_count for p in pages_data)
		avg_chars = total_chars / page_count
		is_scan = avg_chars < min_text_chars_per_page

		# Lebih dari 50% halaman multi-kolom dianggap layout multi-kolom
		is_multi_column = (multi_column_pages / page_count) > 0.5

		err = None
		if is_scan:
			err = "CV berupa gambar/scan, tidak bisa dibaca (kurang dari batas teks per halaman)."

		return ExtractionResult(
			raw_text=full_text,
			normalized_text=norm_text,
			page_count=page_count,
			pages=pages_data,
			is_scan=is_scan,
			is_multi_column=is_multi_column,
			table_count=total_tables,
			error=err,
			file_type="pdf",
		)
	except Exception as exc:
		return ExtractionResult(
			raw_text="",
			normalized_text="",
			page_count=0,
			error=f"Gagal membaca file PDF: {exc}",
			file_type="pdf",
		)


def extract_cv(file_path: str, min_text_chars_per_page: int = 200) -> ExtractionResult:
	"""Fungsi utama untuk mengekstrak CV (PDF atau DOCX)."""
	if not os.path.exists(file_path):
		return ExtractionResult(
			raw_text="",
			normalized_text="",
			page_count=0,
			error=f"Berkas tidak ditemukan: {file_path}",
		)

	ext = os.path.splitext(file_path)[1].lower()
	if ext == ".pdf":
		return extract_pdf(file_path, min_text_chars_per_page=min_text_chars_per_page)
	elif ext in (".docx", ".doc"):
		return extract_docx(file_path)
	else:
		return ExtractionResult(
			raw_text="",
			normalized_text="",
			page_count=0,
			error=f"Format berkas tidak didukung: {ext}. Gunakan PDF atau DOCX.",
			file_type=ext.lstrip("."),
		)
