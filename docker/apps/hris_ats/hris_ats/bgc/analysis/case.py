# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Modul analisis perkara pengadilan (Case History) murni (tanpa import frappe).
Mendeteksi peran para pihak dan memetakan tingkat keparahan (severity) sesuai tabel hukum ketat.
"""

from __future__ import annotations

import re
from typing import Any

ROLE_PATTERNS = [
	("Terdakwa", [r"\bterdakwa(?:\s+i+|(?:\s+[a-z0-9]+))?\b", r"\bterpidana\b"]),
	("Tergugat", [r"\btergugat(?:\s+i+|(?:\s+[a-z0-9]+))?\b", r"\bturut tergugat\b"]),
	("Penggugat", [r"\bpenggugat(?:\s+i+|(?:\s+[a-z0-9]+))?\b"]),
	("Pemohon", [r"\bpemohon(?:\s+i+|(?:\s+[a-z0-9]+))?\b", r"\bpemohon kasasi\b", r"\bpemohon banding\b"]),
	("Termohon", [r"\btermohon(?:\s+i+|(?:\s+[a-z0-9]+))?\b"]),
	("Saksi", [r"\bsaksi(?:\s+i+|(?:\s+[a-z0-9]+))?\b", r"\bdidengar keterangannya sebagai saksi\b"]),
]


def detect_party_role(text: str, candidate_name: str) -> str:
	"""Mendeteksi peran kandidat dalam dokumen putusan menggunakan regex sekitar nama."""
	if not text or not candidate_name:
		return "Tidak diketahui"

	clean_text = text.lower()
	clean_name = candidate_name.strip().lower()

	# Cari jendela 200 karakter sebelum dan sesudah kemunculan nama
	idx = clean_text.find(clean_name)
	if idx != -1:
		start = max(0, idx - 200)
		end = min(len(clean_text), idx + len(clean_name) + 200)
		window = clean_text[start:end]
	else:
		window = clean_text

	for role_name, patterns in ROLE_PATTERNS:
		for pat in patterns:
			if re.search(pat, window):
				return role_name

	return "Tidak diketahui"


def evaluate_case_severity(case_type: str, party_role: str) -> dict[str, Any]:
	"""Memetakan severity putusan sesuai tabel 6.4 SPEC-BACKGROUND-CHECK.md.

	| Jenis                  | Peran             | Severity |
	|------------------------|-------------------|----------|
	| Pidana                 | Terdakwa          | Tinggi   |
	| Perdata/Perdata Khusus | Tergugat          | Sedang   |
	| Perdata                | Penggugat/Pemohon | Info     |
	| Apa pun                | Saksi             | Info     |
	| Agama, TUN             | Apa pun           | Info     |
	"""
	norm_type = (case_type or "").strip().lower()
	norm_role = (party_role or "").strip().lower()

	# Saksi di semua perkara selalu Info
	if "saksi" in norm_role:
		return {"severity": "Info", "category": "Neutral", "is_hidden_by_default": False}

	# Perkara Agama dan TUN selalu Info dan disembunyikan secara default
	if any(k in norm_type for k in ["agama", "tun", "tata usaha negara"]):
		return {"severity": "Info", "category": "Neutral", "is_hidden_by_default": True}

	# Perkara Pidana
	if "pidana" in norm_type:
		if "terdakwa" in norm_role or "terpidana" in norm_role:
			return {"severity": "High", "category": "Risky", "is_hidden_by_default": False}
		else:
			return {"severity": "Info", "category": "Neutral", "is_hidden_by_default": False}

	# Perkara Perdata / Perdata Khusus
	if "perdata" in norm_type:
		if "tergugat" in norm_role:
			return {"severity": "Medium", "category": "Risky", "is_hidden_by_default": False}
		elif any(r in norm_role for r in ["penggugat", "pemohon"]):
			return {"severity": "Info", "category": "Neutral", "is_hidden_by_default": False}
		else:
			return {"severity": "Info", "category": "Neutral", "is_hidden_by_default": False}

	return {"severity": "Info", "category": "Neutral", "is_hidden_by_default": False}
