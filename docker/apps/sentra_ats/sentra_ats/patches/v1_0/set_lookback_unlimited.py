# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Social lookback now defaults to 0 (no limit). Settings still on the old default of 12 are moved to 0."""
	if not frappe.db.exists("DocType", "Background Check Settings"):
		return
	current = frappe.db.get_single_value("Background Check Settings", "social_lookback_months")
	if current in (12, "12"):
		frappe.db.set_single_value("Background Check Settings", "social_lookback_months", 0)
