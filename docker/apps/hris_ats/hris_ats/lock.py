"""Hidden HR modules (Expenses, Payroll, Tax & Benefits), enforced by permissions and not only by the menu.

Frappe docs (Users and Permissions): "To hide a doctype from a User, remove the read permission from a Role using the Role
Permissions Manager", and page/report access goes through "Role Permission for Page and Report" (the Custom Role doctype).
So the doctypes lose every right for every role except System Manager (REST, RPC and URL all go through the same checks),
and the reports are limited to System Manager with a Custom Role. Switch off with `hris_lock_modules` = 0 in site_config;
`revert()` removes the overrides again (frappe.permissions.reset_perms).
"""

import frappe
from frappe.permissions import reset_perms, rights, update_permission_property

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
	from hris_ats.subscription import live_conf

	return bool(live_conf().get("hris_lock_modules", 1))


def apply():
	for dt in LOCKED_DOCTYPES:
		if not frappe.db.exists("DocType", dt):
			continue
		rows = frappe.get_all("DocPerm", filters={"parent": dt}, fields=["role", "permlevel"]) + frappe.get_all(
			"Custom DocPerm", filters={"parent": dt}, fields=["role", "permlevel"]
		)
		for role, level in {(r.role, r.permlevel) for r in rows if r.role != ADMIN}:
			for ptype in rights:
				update_permission_property(dt, role, level, ptype, 0)
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
