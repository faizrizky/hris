# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Accounts marked Connected without a signed-in session are reset so HR logs in again."""
	from hris_ats.bgc.crawler_session import get_decrypted_storage_state, has_auth_cookies

	for acc in frappe.get_all(
		"Background Check Crawler Account", filters={"status": "Connected"}, fields=["name", "platform"]
	):
		state = get_decrypted_storage_state(acc.name)
		if state and has_auth_cookies(acc.platform, state):
			continue
		frappe.db.set_value(
			"Background Check Crawler Account",
			acc.name,
			{
				"status": "Not connected",
				"last_error": "Stored session is missing or not signed in. Please log in again.",
				"last_error_template": "Stored session is missing or not signed in. Please log in again.",
				"last_error_params": "{}",
			},
			update_modified=False,
		)
