# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe

OLD_LABELS = ("Pelamar Baru", "Tahap Screening", "Tahap Background Check", "Tahap Wawancara")


def execute():
	"""Delete suffixed copies of this app's number cards and the unused 'Open Job Openings' card."""
	for name in frappe.get_all("Number Card", filters={"label": ["in", OLD_LABELS]}, pluck="name"):
		if name not in OLD_LABELS:
			frappe.delete_doc("Number Card", name, ignore_permissions=True, force=True)
	if frappe.db.exists("Number Card", "Open Job Openings"):
		frappe.delete_doc("Number Card", "Open Job Openings", ignore_permissions=True, force=True)
