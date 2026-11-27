"""HR-focus profile: trims the Desk for everyone except System Manager, enforced by permissions.

Opt-in per site with `bench --site <site> set-config hris_lite_ui 1`; `apply()` is idempotent and re-run on migrate.
`revert()` puts back what `apply()` changed, using the snapshot saved in the site's private folder.
"""

import json

import frappe
from frappe.custom.doctype.property_setter.property_setter import make_property_setter
from frappe.permissions import add_permission, rights, update_permission_property

from sentra_ats.lock import strip

ADMIN = "System Manager"
# Dedicated level so a future ERPNext/HRMS grant at level 1 can never expose these fields.
LEVEL = 9

# Fields only System Manager can see or edit (permission level 9). Child doctypes use their parent's permissions.
HIDDEN_FIELDS = {
	"Employee": [
		"naming_series", "employee", "prefered_contact_email", "prefered_email", "unsubscribed",
		"current_accommodation_type", "permanent_accommodation_type",
		"custom_em2_name", "custom_em2_relation", "custom_em2_phone",  # replaced by the Additional Emergency Contacts table
		"ctc", "salary_currency", "payroll_cost_center", "employee_advance_account",
		"family_background", "health_details", "health_insurance_section", "health_insurance_provider",
		"health_insurance_no", "new_workplace",
	],
	"Department": ["payroll_cost_center"],
	"Activity Type": ["costing_rate", "billing_rate", "disabled"],
	"Timesheet": [
		"naming_series", "parent_project", "customer", "currency", "exchange_rate", "billing_tab",
		"total_billable_hours", "total_billable_amount", "base_total_billable_amount",
	],
	"Timesheet Detail": ["project", "project_name", "is_billable"],
	"Overtime Type": ["applicable_salary_component"],
	"Leave Application": ["naming_series", "follow_via_email", "salary_slip", "letter_head"],
	"Leave Encashment": ["encashment_days", "pay_via_payment_entry", "encashment_date"],
	"Leave Allocation": ["naming_series"],
	"Holiday List Assignment": ["naming_series"],
	"Employee Promotion": ["current_ctc"],
	"Employee Grievance": ["associated_document_type", "associated_document"],
	"Job Requisition": ["naming_series"],
}
PARENT_OF = {"Timesheet Detail": "Timesheet"}

# Series fields are mandatory but hidden above, so the form would refuse to save any record that has no series value
# (seeded or imported ones). The series is filled automatically when a record is created, so it need not be required.
NOT_REQUIRED = {
	"Employee": ["naming_series"], "Timesheet": ["naming_series"], "Leave Application": ["naming_series"],
	"Leave Allocation": ["naming_series"], "Holiday List Assignment": ["naming_series"],
}

# Column breaks that would leave an empty column once the fields above are gone.
HIDDEN_COLUMNS = {"Employee": ["column_break4", "salary_cb"], "Activity Type": ["column_break_3"]}

# Roles that lose write access (read stays, so link fields and forms keep working).
READ_ONLY = {"Company": ["HR Manager"]}

# Settings screens reached from the menus: System Manager only (sentra_ats.lock.strip). Print Settings stays readable
# because every print view needs it; Payroll Settings is already locked with Payroll.
SETTINGS_LOCKED = [
	"HR Settings", "Face Settings", "Resume Screening Settings", "Background Check Settings", "Accounts Settings",
	"Selling Settings", "Buying Settings", "Stock Settings", "Manufacturing Settings", "Projects Settings", "CRM Settings",
	"Support Settings", "POS Settings", "Subscription Settings", "Item Variant Settings", "Delivery Settings",
	"Currency Exchange Settings", "Appointment Booking Settings", "Stock Reposting Settings", "SMS Settings",
	"Incoming Call Settings", "Voice Call Settings", "Global Defaults",
]
WRITE_PTYPES = ("write", "create", "delete", "submit", "cancel", "amend", "import")

# Roles that lose every right on the doctype.
NO_ACCESS = {"Travel Request": ["Employee Self Service", "Employee", "HR User", "HR Manager"]}

# Reports limited to System Manager.
REPORTS = [
	"Monthly Attendance Sheet", "Shift Attendance", "Employee Hours Utilization Based On Timesheet",
	"Project Profitability", "Employee Leave Balance", "Employee Leave Balance Summary",
	"Employees working on a holiday", "Appraisal Overview", "Employee Exits", "Employee Birthday",
	"Employee Information", "Employee Analytics", "Recruitment Analytics",
	# the ERPNext menus' reports
	"General Ledger", "Trial Balance", "Trial Balance for Party", "Profit and Loss Statement", "Balance Sheet", "Cash Flow",
	"Consolidated Financial Statement", "Profitability Analysis", "Accounts Receivable", "Accounts Payable",
	"Accounts Receivable Summary", "Accounts Payable Summary", "Budget Variance Report", "Sales Analytics",
	"Sales Register", "Gross Profit", "Purchase Analytics", "Purchase Order Analysis", "Purchase Register",
	"Supplier Quotation Comparison", "Stock Ledger", "Stock Balance", "Stock Projected Qty", "Stock Ageing",
	"Stock Analytics", "Production Analytics", "Work Order Summary", "Job Card Summary", "Production Planning Report",
	"Material Requirements Planning Report", "Project Summary", "Timesheet Billing Summary", "Daily Timesheet Summary",
	"Delayed Tasks Summary", "Project wise Stock Tracking", "Fixed Asset Register", "Asset Depreciation Ledger",
	"Asset Depreciations and Balances", "Asset Activity", "Quality Inspection Summary", "Review", "Maintenance Schedules",
	"Lead Details", "Sales Pipeline Analytics", "Opportunity Summary by Sales Stage",
	"Prospects Engaged But Not Converted", "First Response Time for Opportunity", "Campaign Efficiency",
	"Lead Owner Efficiency", "First Response Time for Issues",
]

# Desk sidebar entries removed for non-admins; "Reports" removes the whole section.
SIDEBAR_HIDE = {
	"HR Setup": {"Home", "Company", "Settings"},
	"Shift & Attendance": {"Home", "Settings", "Reports"},
	"Leaves": {"Home", "Settings", "Reports"},
	"Performance": {"Home", "Reports"},
	"Tenure": {"Home", "Settings", "Reports"},
	"Recruitment": {"Home", "Settings", "Reports"},
	"Expenses": {"Travel Request"},
}


def filter_items(items, hide):
	"""Drop entries named in `hide`; a hidden Section Break takes its children with it.

	A section left with nothing under it (its entries were hidden here or removed by permissions) loses its heading too."""
	kept, skipping = [], False
	for item in items:
		if item.get("type") == "Section Break":
			skipping = item.get("label") in hide
		elif not item.get("child"):
			skipping = False
		if not skipping and item.get("label") not in hide:
			kept.append(item)
	return [
		item for i, item in enumerate(kept)
		if item.get("type") != "Section Break" or (i + 1 < len(kept) and kept[i + 1].get("type") != "Section Break")
	]


def drop_reports_settings(items):
	"""A menu without its reports and settings screens (their permissions are limited separately)."""
	hide = {"Reports", "Settings"}
	for item in items:
		target = item.get("link_to") or ""
		if item.get("link_type") == "Report" or target.endswith(" Settings") or target in ("Global Defaults", "sales-funnel"):
			hide.add(item.get("label"))
	return filter_items(items, hide)


def _snapshot_path():
	return frappe.get_site_path("private", "hris_lite_snapshot.json")


def _load_snapshot():
	try:
		with open(_snapshot_path()) as f:
			return json.load(f)
	except FileNotFoundError:
		return None


def _perm_doctypes():
	return {PARENT_OF.get(dt, dt) for dt in HIDDEN_FIELDS} | set(READ_ONLY) | set(NO_ACCESS) | set(SETTINGS_LOCKED)


def _setter_value(dt, fn, prop="permlevel"):
	return frappe.db.get_value("Property Setter", {"doc_type": dt, "field_name": fn, "property": prop}, "value")


def _restore_field(key, old, prop="permlevel", ptype="Int"):
	dt, fn = key.split(":")
	if old is None:
		frappe.db.delete("Property Setter", {"doc_type": dt, "field_name": fn, "property": prop})
	else:
		make_property_setter(dt, fn, prop, int(old), ptype)


def apply():
	frappe.only_for(ADMIN)
	snap = _load_snapshot() or {"perms": {}, "fields": {}, "reports": {}}
	snap.setdefault("required", {})
	wanted = {f"{dt}:{fn}" for dt, fns in HIDDEN_FIELDS.items() for fn in fns}
	# Record the original state of anything the profile touches for the first time...
	for key in wanted - snap["fields"].keys():
		snap["fields"][key] = _setter_value(*key.split(":"))
	for dt in _perm_doctypes() - snap["perms"].keys():
		snap["perms"][dt] = frappe.get_all("Custom DocPerm", filters={"parent": dt}, fields=["*"])
	for r in REPORTS:
		if r not in snap["reports"] and frappe.db.exists("Report", r):
			snap["reports"][r] = frappe.get_all("Has Role", filters={"parenttype": "Report", "parent": r}, pluck="role")
	# ...and give back fields that earlier versions of the profile hid but this one no longer does.
	for key in snap["fields"].keys() - wanted:
		_restore_field(key, snap["fields"].pop(key))
	relaxed = {f"{dt}:{fn}" for dt, fns in NOT_REQUIRED.items() for fn in fns}
	for key in relaxed - snap["required"].keys():
		snap["required"][key] = _setter_value(*key.split(":"), "reqd")
	for key in snap["required"].keys() - relaxed:
		_restore_field(key, snap["required"].pop(key), "reqd", "Check")
	with open(_snapshot_path(), "w") as f:
		json.dump(snap, f, default=str)

	for key in relaxed:
		dt, fn = key.split(":")
		make_property_setter(dt, fn, "reqd", 0, "Check")
	for dt, fns in HIDDEN_FIELDS.items():
		for fn in fns:
			make_property_setter(dt, fn, "permlevel", LEVEL, "Int")
		parent = PARENT_OF.get(dt, dt)
		if dt == parent:
			add_permission(parent, ADMIN, LEVEL)
			for ptype in ("read", "write"):
				update_permission_property(parent, ADMIN, LEVEL, ptype, 1)

	for dt, roles in READ_ONLY.items():
		for role in roles:
			if frappe.db.exists("Custom DocPerm", {"parent": dt, "role": role, "permlevel": 0}) or frappe.get_all(
				"DocPerm", filters={"parent": dt, "role": role, "permlevel": 0}
			):
				for ptype in WRITE_PTYPES:
					update_permission_property(dt, role, 0, ptype, 0)

	for dt, roles in NO_ACCESS.items():
		for role in roles:
			if frappe.get_all("DocPerm", filters={"parent": dt, "role": role, "permlevel": 0}) or frappe.db.exists(
				"Custom DocPerm", {"parent": dt, "role": role, "permlevel": 0}
			):
				for ptype in rights:
					update_permission_property(dt, role, 0, ptype, 0)

	for dt in SETTINGS_LOCKED:
		if frappe.db.exists("DocType", dt):
			strip(dt)

	for dt, fns in HIDDEN_COLUMNS.items():
		for fn in fns:
			if frappe.get_meta(dt).has_field(fn):
				make_property_setter(dt, fn, "hidden", 1, "Check")

	for r in snap["reports"]:
		_set_report_roles(r, [ADMIN])
	frappe.clear_cache()


def revert():
	frappe.only_for(ADMIN)
	snap = _load_snapshot()
	if snap is None:
		return
	for key, old in snap["fields"].items():
		_restore_field(key, old)
	for key, old in snap.get("required", {}).items():
		_restore_field(key, old, "reqd", "Check")
	for dt, fns in HIDDEN_COLUMNS.items():
		for fn in fns:
			frappe.db.delete("Property Setter", {"doc_type": dt, "field_name": fn, "property": "hidden"})
	for dt, rows in snap["perms"].items():
		frappe.db.delete("Custom DocPerm", {"parent": dt})
		for row in rows:
			frappe.get_doc({**row, "doctype": "Custom DocPerm"}).insert(ignore_permissions=True, ignore_if_duplicate=True)
	for r, roles in snap["reports"].items():
		_set_report_roles(r, roles)
	frappe.clear_cache()


def _set_report_roles(report, roles):
	# Plain DB writes: saving a standard Report would export it to the app's files in developer mode, and
	# HasRole.before_insert rejects a role if any doctype with the same name already holds it.
	frappe.db.delete("Has Role", {"parenttype": "Report", "parent": report, "role": ("not in", roles)})
	have = set(frappe.get_all("Has Role", filters={"parenttype": "Report", "parent": report}, pluck="role"))
	for role in set(roles) - have:
		row = frappe.get_doc(
			{"doctype": "Has Role", "parenttype": "Report", "parentfield": "roles", "parent": report, "role": role}
		)
		row.name = frappe.generate_hash(length=10)
		row.set_user_and_timestamp()
		row.db_insert()
