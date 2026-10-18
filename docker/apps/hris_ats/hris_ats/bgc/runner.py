# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Background job runner untuk pemeriksaan Background Check per sumber yang disetujui."""

from __future__ import annotations
import frappe


def run_all_sources(bgc_name: str) -> None:
	"""Entry point untuk background job pemrosesan semua sumber Background Check."""
	if not frappe.db.exists("Background Check", bgc_name):
		return
	# Implementasi lengkap pada Fase 6
