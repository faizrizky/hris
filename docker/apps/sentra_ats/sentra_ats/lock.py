"""Hidden HR modules (Expenses, Payroll, Tax & Benefits), enforced by permissions and not only by the menu.

Frappe docs (Users and Permissions): "To hide a doctype from a User, remove the read permission from a Role using the Role
Permissions Manager", and page/report access goes through "Role Permission for Page and Report" (the Custom Role doctype).
So the doctypes lose every right for every role except System Manager (REST, RPC and URL all go through the same checks),
and the reports are limited to System Manager with a Custom Role. Switch off with `hris_lock_modules` = 0 in site_config;
`revert()` removes the overrides again (frappe.permissions.reset_perms).
"""

import frappe
from frappe.core.doctype.custom_docperm.custom_docperm import update_custom_docperm
from frappe.permissions import add_permission, reset_perms, rights, setup_custom_perms

ADMIN = "System Manager"

# Doctypes that only these three sidebars own. Shared ones (Payment Entry, Journal Entry, HR Settings, Company) stay open.
LOCKED_DOCTYPES = (
	# Expenses
	"Expense Claim", "Employee Advance", "Expense Claim Type", "Purpose of Travel", "Travel Request", "Vehicle Log",
	# Payroll
	"Payroll Entry", "Salary Structure Assignment", "Salary Slip", "Additional Salary", "Salary Withholding",
	"Salary Component", "Salary Structure", "Payroll Settings",
	# Tax & Benefits
	"Employee Tax Exemption Declaration", "Employee Tax Exemption Proof Submission", "Employee Benefit Claim",
	"Employee Benefit Application", "Employee Benefit Ledger", "Gratuity Rule", "Gratuity", "Income Tax Slab",
	"Employee Tax Exemption Category",
)
LOCKED_REPORTS = (
	"Unpaid Expense Claim", "Vehicle Expenses", "Employee CTC Break-up", "Salary Register", "Income Tax Computation",
	"Income Tax Deductions", "Accrued Earnings Report",
)
# Sidebars (rails) removed from the Desk menu.
HIDDEN_RAILS = ("Expenses", "Payroll", "Tax & Benefits")


def enabled() -> bool:
	from sentra_ats.subscription import live_conf

	return bool(live_conf().get("hris_lock_modules", 1))


def strip(dt):
	"""Take every right on a doctype away from every role but System Manager, which keeps a full row."""
	setup_custom_perms(dt)  # copies the standard rows into Custom DocPerm the first time, as the Role Permissions Manager does
	# System Manager needs a full row of its own: if no role may read the doctype, Frappe also refuses field access to
	# Administrator ("You do not have permission to access field: ..."), and HR forms query these doctypes.
	add_permission(dt, ADMIN, 0)
	admin_row = frappe.db.get_value("Custom DocPerm", {"parent": dt, "role": ADMIN, "permlevel": 0, "if_owner": 0})
	if admin_row:
		update_custom_docperm(admin_row, {p: 1 for p in rights})
	for row in frappe.get_all("Custom DocPerm", filters={"parent": dt, "role": ("!=", ADMIN)}, fields=["name", *rights]):
		if any(row[p] for p in rights):
			update_custom_docperm(row.name, {p: 0 for p in rights})


def apply():
	"""One save per permission row that still grants something, so a repeat run (every migrate) is nearly free."""
	for dt in LOCKED_DOCTYPES:
		if frappe.db.exists("DocType", dt):
			strip(dt)
	for report in LOCKED_REPORTS:
		if not frappe.db.exists("Report", report):
			continue
		name = frappe.db.exists("Custom Role", {"report": report})
		doc = frappe.get_doc("Custom Role", name) if name else frappe.new_doc("Custom Role")
		doc.report = report
		doc.set("roles", [{"role": ADMIN}])
		doc.save(ignore_permissions=True)
	frappe.clear_cache()


def revert():
	for dt in LOCKED_DOCTYPES:
		if frappe.db.exists("DocType", dt):
			reset_perms(dt)
	for name in frappe.get_all("Custom Role", filters={"report": ("in", LOCKED_REPORTS)}, pluck="name"):
		frappe.delete_doc("Custom Role", name, ignore_permissions=True)
	frappe.clear_cache()


def after_migrate():
	if enabled():
		apply()
