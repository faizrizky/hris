# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Migrasi Fase 5: Memastikan field baru ada pada dokumen lama dan dibiarkan kosong tanpa hitung ulang."""
	# Field baru pada Background Check Account, Background Check Finding, Background Check Platform
	# disinkronisasi melalui skema DocType oleh bench migrate.
	# Dokumen lama dibiarkan kosong sesuai instruksi spesifikasi 5a.
	pass
