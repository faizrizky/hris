# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe

OWN_CARD_LABELS = ("New Applicants", "Screening Stage", "Background Check Stage", "Interview Stage")


def execute():
	"""Undo earlier side effects and give the 'Rekrutmen' workspace its content.

	1. An older setup overwrote the standard HRMS 'Recruitment' workspace; re-import it from HRMS.
	2. The same setup created a new Number Card on every migrate (name-suffixed copies); delete them.
	"""
	try:
		from frappe.modules.import_file import import_file_by_path

		path = frappe.get_app_path("hrms", "recruitment", "workspace", "recruitment", "recruitment.json")
		import_file_by_path(path, force=True)
	except Exception:
		frappe.log_error(title="Restore HRMS Recruitment workspace failed", message=frappe.get_traceback())

	for name in frappe.get_all("Number Card", filters={"label": ["in", OWN_CARD_LABELS]}, pluck="name"):
		if name not in OWN_CARD_LABELS:
			frappe.delete_doc("Number Card", name, ignore_permissions=True, force=True)

	from hris_ats.setup import setup_dashboard_charts, setup_number_cards, setup_rekrutmen_workspace

	setup_number_cards()
	setup_dashboard_charts()
	setup_rekrutmen_workspace()
