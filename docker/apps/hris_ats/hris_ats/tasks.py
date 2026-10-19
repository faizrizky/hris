# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Tugas harian (daily scheduled task) untuk retensi data Background Check.
Menghapus temuan mentah, ringkasan otomatis, dan data akun setelah tanggal purge_after tercapai,
serta memperbarui status SKCK yang telah lewat masa berlakunya.
"""

from __future__ import annotations

import frappe
from frappe.utils import getdate, nowdate


def daily_retention_purge() -> dict[str, int]:
	"""Eksekusi pembersihan retensi harian."""
	today = getdate(nowdate())

	# 1. Periksa SKCK yang telah kedaluwarsa
	skck_expired_records = frappe.get_all(
		"Background Check",
		filters={
			"skck_valid_until": ["<", today],
			"skck_status": ["not in", ["Expired", "Kedaluwarsa"]],
		},
		pluck="name",
	)
	for name in skck_expired_records:
		frappe.db.set_value("Background Check", name, "skck_status", "Expired", update_modified=False)

	# 2. Temukan dokumen BGC yang melewati purge_after dan belum dipurge
	expired_bgcs = frappe.get_all(
		"Background Check",
		filters={
			"purge_after": ["<=", today],
			"is_purged": 0,
		},
		pluck="name",
	)

	total_findings_deleted = 0
	total_bgcs_purged = 0

	for bgc_name in expired_bgcs:
		# Hapus temuan mentah (Finding)
		findings_deleted = frappe.db.count("Background Check Finding", {"background_check": bgc_name})
		frappe.db.delete("Background Check Finding", {"background_check": bgc_name})
		total_findings_deleted += findings_deleted

		# Bersihkan ringkasan otomatis dan akun terdaftar, pertahankan kesimpulan & bukti consent
		bgc = frappe.get_doc("Background Check", bgc_name)
		bgc.summary_auto = None
		bgc.summary_auto_template = None
		bgc.summary_auto_params = None
		bgc.accounts = []
		bgc.is_purged = 1
		bgc.save(ignore_permissions=True)
		total_bgcs_purged += 1

	# 3. Bersihkan berkas/direktori crawl yang tersisa di private/hris_ats/crawl/
	try:
		import os
		import shutil
		crawl_base = os.path.abspath(frappe.get_site_path("private", "hris_ats", "crawl"))
		if os.path.exists(crawl_base):
			for item in os.listdir(crawl_base):
				item_path = os.path.join(crawl_base, item)
				if os.path.isdir(item_path):
					shutil.rmtree(item_path, ignore_errors=True)
	except Exception:
		pass

	return {
		"bgcs_purged": total_bgcs_purged,
		"findings_deleted": total_findings_deleted,
		"skck_expired_updated": len(skck_expired_records),
	}
