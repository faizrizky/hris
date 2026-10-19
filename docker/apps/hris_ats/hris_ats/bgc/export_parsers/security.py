# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Keamanan ekstraksi arsip ekspor data kandidat (Spesifikasi 5.3 & Fase 4).
Mencegah Zip-Slip (path traversal), Zip-Bomb (rasio kompresi / ukuran dekompresi raksasa),
dan memastikan arsip diproses secara aman dalam batas export_max_mb.
"""

from __future__ import annotations

import io
import os
import zipfile
from typing import Any


class ExportSecurityError(Exception):
	"""Kesalahan keamanan pemrosesan arsip ekspor."""
	pass


class ZipSlipError(ExportSecurityError):
	"""Terdeteksi path traversal dalam nama berkas arsip."""
	pass


class ZipBombError(ExportSecurityError):
	"""Terdeteksi rasio kompresi atau ukuran dekompresi melebihi batas aman."""
	pass


class ArchiveSizeExceededError(ExportSecurityError):
	"""Ukuran berkas arsip melebihi batas maksimum."""
	pass


MAX_UNCOMPRESSED_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB
MAX_COMPRESSION_RATIO = 50.0  # Rasio maksimal uncompressed : compressed
MAX_FILE_COUNT = 1000  # Maksimal 1.000 berkas di dalam zip


def safe_extract_export_archive(
	archive_source: str | bytes | io.BytesIO,
	max_size_mb: int = 100,
	allowed_extensions: tuple[str, ...] = (".json", ".csv", ".html", ".htm", ".txt"),
) -> dict[str, bytes]:
	"""Mengekstrak berkas dari arsip ZIP atau membaca berkas JSON/CSV langsung ke memori (dict: rel_path -> bytes).

	Memvalidasi:
	1. Batas ukuran berkas arsip mentah <= max_size_mb.
	2. Penolakan Zip-Slip: nama berkas tidak boleh memuat '..', prefix '/', drive letter Windows.
	3. Penolakan Zip-Bomb: batasan uncompressed size (maks 500 MB), rasio <= 50, jumlah berkas <= 1.000.
	4. Hanya membaca berkas dengan ekstensi teks yang diizinkan (gambar/video besar diabaikan).
	"""
	max_raw_bytes = max_size_mb * 1024 * 1024

	raw_bytes: bytes
	if isinstance(archive_source, str):
		if not os.path.exists(archive_source):
			raise FileNotFoundError(f"Archive file not found: {archive_source}")
		file_size = os.path.getsize(archive_source)
		if file_size > max_raw_bytes:
			raise ArchiveSizeExceededError(
				f"Archive size {file_size / (1024*1024):.1f} MB exceeds maximum limit of {max_size_mb} MB"
			)
		with open(archive_source, "rb") as f:
			raw_bytes = f.read()
	elif isinstance(archive_source, io.BytesIO):
		raw_bytes = archive_source.getvalue()
	else:
		raw_bytes = archive_source

	if len(raw_bytes) > max_raw_bytes:
		raise ArchiveSizeExceededError(
			f"Archive size {len(raw_bytes) / (1024*1024):.1f} MB exceeds maximum limit of {max_size_mb} MB"
		)

	# Jika berkas mentah adalah JSON atau CSV langsung (bukan zip)
	if not raw_bytes.startswith(b"PK\x03\x04") and not raw_bytes.startswith(b"PK\x05\x06"):
		# Berkas tunggal JSON atau CSV
		return {"data.json": raw_bytes}

	extracted_files: dict[str, bytes] = {}
	total_uncompressed_bytes = 0

	with zipfile.ZipFile(io.BytesIO(raw_bytes), "r") as zf:
		infolist = zf.infolist()
		if len(infolist) > MAX_FILE_COUNT:
			raise ZipBombError(
				f"Archive file count ({len(infolist)}) exceeds maximum limit of {MAX_FILE_COUNT}"
			)

		for info in infolist:
			# Abaikan direktori
			if info.is_dir():
				continue

			filename = info.filename.replace("\\", "/")

			# 1. Zip-Slip Guard
			if ".." in filename or filename.startswith("/") or ":" in filename:
				raise ZipSlipError(f"Potential zip-slip path traversal detected: {info.filename}")

			# Normalisasi path
			norm_path = os.path.normpath(filename).replace("\\", "/")
			if norm_path.startswith("..") or norm_path.startswith("/"):
				raise ZipSlipError(f"Potential zip-slip path traversal detected: {info.filename}")

			# 2. Zip-Bomb Guards
			total_uncompressed_bytes += info.file_size
			if total_uncompressed_bytes > MAX_UNCOMPRESSED_SIZE_BYTES:
				raise ZipBombError(
					f"Total uncompressed size exceeds limit of {MAX_UNCOMPRESSED_SIZE_BYTES / (1024*1024):.0f} MB"
				)

			if info.compress_size > 0:
				ratio = info.file_size / info.compress_size
				if ratio > MAX_COMPRESSION_RATIO and info.file_size > 1024 * 1024:
					raise ZipBombError(
						f"Suspicious compression ratio ({ratio:.1f}) for file {info.filename}"
					)

			# 3. Filter ekstensi teks (lewati media besar seperti video/mp4/jpg di dalam arsip)
			lower_name = norm_path.lower()
			if any(lower_name.endswith(ext) for ext in allowed_extensions):
				extracted_files[norm_path] = zf.read(info)

	return extracted_files
