"""Employee bank details come from ERPNext's Bank Account (party = the employee), so there is one source of truth."""

import frappe
from frappe.permissions import add_permission, update_permission_property

# Roles that already manage company bank accounts; everyone else only ever sees employee accounts.
PRIVILEGED = {"System Manager", "Accounts Manager", "Accounts User"}
HR_ROLES = ("HR Manager", "HR User")


def _privileged(user) -> bool:
	return user == "Administrator" or bool(PRIVILEGED & set(frappe.get_roles(user)))


def bank_account_conditions(user=None):
	user = user or frappe.session.user
	return "" if _privileged(user) else "`tabBank Account`.party_type = 'Employee'"


def bank_account_has_permission(doc, ptype=None, user=None, debug=False):
	# Frappe v16: a controller hook only passes when it returns True (None counts as a denial).
	return _privileged(user or frappe.session.user) or doc.party_type == "Employee"


def mirror_to_employee(doc, method=None):
	"""Keep the standard bank columns (read by payroll reports) in step with the linked Bank Account."""
	if not doc.get("custom_bank_account"):
		return
	account = frappe.db.get_value("Bank Account", doc.custom_bank_account, ["bank", "bank_account_no", "iban"], as_dict=True)
	if account:
		doc.bank_name, doc.bank_ac_no, doc.iban = account.bank, account.bank_account_no, account.iban


def setup_bank_account_access():
	"""HR may create and edit employee bank accounts; the query condition above keeps company accounts out of sight."""
	for role in HR_ROLES:
		add_permission("Bank Account", role, 0)
		for ptype in ("read", "write", "create"):
			update_permission_property("Bank Account", role, 0, ptype, 1)
	for fieldname in ("bank_name", "bank_ac_no", "iban"):
		frappe.make_property_setter(
			{"doctype": "Employee", "doctype_or_field": "DocField", "fieldname": fieldname,
				"property": "hidden", "value": 1, "property_type": "Check"}
		)
