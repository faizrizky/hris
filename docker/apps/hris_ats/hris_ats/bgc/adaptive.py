# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul pelacakan elemen adaptif (Smart Element Tracking) berbasis Scrapling.
Menyimpan model pelacakan di sites/<site>/private/hris_ats/ (bukan di folder app, bukan di /tmp).
Mendeteksi perubahan struktur situs dan mendeteksi relokasi dengan kemiripan rendah.
"""

from __future__ import annotations

import os
from typing import Any, Tuple

try:
	from scrapling.parser import Adaptor
	from scrapling.core.storage import SQLiteStorageSystem
except ImportError:
	Adaptor = None
	SQLiteStorageSystem = None


def get_adaptive_storage_dir(site_name: str | None = None) -> str:
	"""Mendapatkan path direktori penyimpanan tracking adaptif di sites/<site>/private/hris_ats/."""
	try:
		import frappe
		if hasattr(frappe, "get_site_path") and getattr(frappe, "local", None) and getattr(frappe.local, "site", None):
			path = os.path.abspath(frappe.get_site_path("private", "hris_ats"))
			os.makedirs(path, exist_ok=True)
			return path
	except Exception:
		pass

	# Fallback bila di luar frappe context
	site = site_name or "hris.localhost"
	base_bench = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
	candidate = os.path.join(base_bench, "sites", site, "private", "hris_ats")
	if os.path.exists(os.path.dirname(candidate)):
		os.makedirs(candidate, exist_ok=True)
		return candidate

	fallback = os.path.abspath(os.path.join(base_bench, "private", "hris_ats"))
	os.makedirs(fallback, exist_ok=True)
	return fallback


def get_adaptive_db_file(site_name: str | None = None) -> str:
	"""Mendapatkan path berkas database SQLite untuk adaptive tracking."""
	folder = get_adaptive_storage_dir(site_name=site_name)
	return os.path.join(folder, "scrapling_adaptive.db")


def create_adaptive_adaptor(
	content: str | bytes,
	url: str = "",
	storage_file: str | None = None,
) -> Any:
	"""Membuat instance Adaptor Scrapling dengan fitur adaptive aktif dan database di sites/<site>/private/hris_ats/."""
	if Adaptor is None:
		return None

	db_path = storage_file or get_adaptive_db_file()
	return Adaptor(
		content=content,
		url=url,
		adaptive=True,
		storage_args={"storage_file": db_path, "url": url},
	)


def query_adaptive_element(
	page: Any,
	selector: str,
	identifier: str,
	min_acceptable_similarity: float = 65.0,
	warning_threshold: float = 85.0,
) -> Tuple[Any, float, str | None]:
	"""
	Menjalankan pencarian selektor CSS dengan pelacakan adaptif.
	Mengembalikan: (elements, similarity_score, warning_message)
	- Jika elemen cocok langsung dengan CSS: similarity 100.0, warning None, auto-saved.
	- Jika elemen direlokasi secara adaptif:
	  * Bila similarity >= warning_threshold: elemen valid, warning None.
	  * Bila min_acceptable_similarity <= similarity < warning_threshold:
	    elemen dipakai tapi dicatat peringatan perubahan struktur.
	  * Bila similarity < min_acceptable_similarity:
	    elemen dianggap salah (tidak dipakai, None dikembalikan), dicatat peringatan keras.
	"""
	if page is None or not selector:
		return None, 0.0, None

	is_adaptive = bool(getattr(page, "_Selector__adaptive_enabled", False))

	# 1. Coba pencarian langsung
	try:
		if is_adaptive:
			direct_matches = page.css(selector, identifier=identifier, auto_save=True)
		else:
			direct_matches = page.css(selector)
		if direct_matches:
			return direct_matches, 100.0, None
	except Exception:
		direct_matches = None

	# 2. Jika tidak ditemukan dan adaptif aktif, coba relocate
	if is_adaptive and hasattr(page, "retrieve") and hasattr(page, "relocate"):
		try:
			stored = page.retrieve(identifier)
			if stored:
				relocated = page.relocate(stored, percentage=int(min_acceptable_similarity), selector_type=True)
				if relocated:
					first_elem = relocated[0]
					score = 100.0
					if hasattr(page, "_Selector__calculate_similarity_score") and hasattr(first_elem, "_root"):
						score = page._Selector__calculate_similarity_score(stored, first_elem._root)
					elif hasattr(first_elem, "_calculate_similarity_score") and hasattr(first_elem, "_root"):
						score = first_elem._calculate_similarity_score(stored, first_elem._root)

					if score < min_acceptable_similarity:
						warning = (
							f"Peringatan: Elemen '{identifier}' ditemukan dengan kemiripan rendah ({score:.1f}%). "
							f"Kemungkinan struktur situs berubah drastis sehingga elemen diabaikan demi akurasi."
						)
						return None, score, warning

					warning = None
					if score < warning_threshold:
						warning = (
							f"Peringatan: Elemen '{identifier}' direlokasi secara adaptif dengan kemiripan {score:.1f}% "
							f"(struktur situs berubah dari selektor awal '{selector}')."
						)

					return relocated, score, warning
				else:
					# Cek apakah ada elemen yang cocok dengan persentase rendah
					low_relocated = page.relocate(stored, percentage=25, selector_type=True)
					if low_relocated:
						first_elem = low_relocated[0]
						score = 0.0
						if hasattr(page, "_Selector__calculate_similarity_score") and hasattr(first_elem, "_root"):
							score = page._Selector__calculate_similarity_score(stored, first_elem._root)
						warning = (
							f"Peringatan: Elemen '{identifier}' ditemukan dengan kemiripan rendah ({score:.1f}%). "
							f"Kemungkinan struktur situs berubah drastis sehingga elemen diabaikan demi akurasi."
						)
						return None, score, warning
		except Exception:
			pass

	return None, 0.0, None
