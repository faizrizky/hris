"""Overrides of whitelisted HRMS methods (hook `override_whitelisted_methods`), without touching HRMS files."""

import frappe


@frappe.whitelist()
def get_assignable_masters(company: str) -> dict[str, bool]:
	"""Same answer as hrms.overrides.employee_master.get_assignable_masters, but a doctype the user may not read (Salary
	Structure is locked, see hris_ats.lock) counts as "nothing to assign" instead of raising a Permission Error on the
	Employee form."""
	masters = {
		"Leave Policy": {"docstatus": 1},
		"Salary Structure": {"docstatus": 1, "is_active": "Yes", "company": company},
		"Shift Schedule": {"docstatus": 1},
	}
	return {
		doctype: frappe.has_permission(doctype, "read")
		and bool(frappe.get_list(doctype, filters=filters, limit=1, pluck="name"))
		for doctype, filters in masters.items()
	}
