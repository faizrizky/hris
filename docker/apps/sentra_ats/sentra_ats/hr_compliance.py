"""Indonesian employment rules that sit on top of HRMS: identity numbers, PKWT/PKWTT, and THR.

Sources checked: UU 13/2003 Pasal 58 and 60 (no probation on PKWT, probation at most 3 months), PP 35/2021 Pasal 8
(PKWT at most 5 years including extensions), Permenaker 6/2016 (THR: 12+ months = one month's wage, 1 to under 12
months = months worked / 12 x one month's wage).
"""

import re

import frappe
from dateutil.relativedelta import relativedelta
from frappe import _
from frappe.utils import cint, flt, getdate

THR_COMPONENT = "THR"
PKWT_MAX_YEARS = 5
PROBATION_MAX_MONTHS = 3


def digits(value) -> str:
	return re.sub(r"[\s.\-]", "", value or "")


MESSAGES = (
	"NIK must be 16 digits.",
	"NPWP must be 15 or 16 digits.",
	"BPJS Ketenagakerjaan number must contain digits only.",
	"BPJS Kesehatan number must contain digits only.",
	"PKWT cannot have a probation period.",
	"PKWT needs a contract end date.",
	"PKWT cannot run longer than 5 years including extensions.",
	"Contract end date is before the start date.",
	"Probation cannot exceed 3 months.",
)


def validate_identity(nik, npwp, bpjs_tk, bpjs_kes) -> list[str]:
	"""Returns the problems found (keys of MESSAGES); a blank number is fine, a malformed one is not."""
	problems = []
	for message, raw, lengths in (
		(MESSAGES[0], nik, (16,)), (MESSAGES[1], npwp, (15, 16)), (MESSAGES[2], bpjs_tk, None), (MESSAGES[3], bpjs_kes, None),
	):
		number = digits(raw)
		if number and (not number.isdigit() or (lengths and len(number) not in lengths)):
			problems.append(message)
	return problems


def validate_contract(contract_type, start, end, probation_months) -> list[str]:
	problems = []
	probation = cint(probation_months)
	if contract_type == "PKWT":
		if probation:
			problems.append(MESSAGES[4])
		if not end:
			problems.append(MESSAGES[5])
		elif start and getdate(end) < getdate(start):
			problems.append(MESSAGES[7])
		elif start and getdate(end) > getdate(start) + relativedelta(years=PKWT_MAX_YEARS):
			problems.append(MESSAGES[6])
	elif probation > PROBATION_MAX_MONTHS:
		problems.append(MESSAGES[8])
	return problems


def validate_employee(doc, method=None):
	problems = validate_identity(doc.get("custom_nik"), doc.get("custom_npwp"), doc.get("custom_bpjs_tk_no"), doc.get("custom_bpjs_kes_no"))
	problems += validate_contract(
		doc.get("custom_contract_type"), doc.get("date_of_joining"), doc.get("contract_end_date"), doc.get("custom_probation_months")
	)
	if problems:
		frappe.throw("<br>".join(_(p) for p in problems), title=_("Check the employee data"))  # the keys are in id.csv


def thr_months(joined, on_date) -> int:
	"""Whole months of service up to `on_date`, capped at 12 (a full year already earns the full amount)."""
	gap = relativedelta(getdate(on_date), getdate(joined))
	return max(0, min(12, gap.years * 12 + gap.months))


def thr_amount(monthly_wage, months) -> float:
	return round(flt(monthly_wage) * min(max(cint(months), 0), 12) / 12)


def _monthly_wage(employee) -> float:
	"""Basic salary of the latest structure assignment plus the fixed position allowance; meals and transport are excluded."""
	base = frappe.db.get_value(
		"Salary Structure Assignment", {"employee": employee, "docstatus": 1}, "base", order_by="from_date desc"
	)
	allowance = frappe.db.get_value("Employee", employee, "custom_tunjangan_jabatan") or 0
	return flt(base) + flt(allowance)


@frappe.whitelist()
def generate_thr(payment_date, company=None, create=0):
	"""Preview (or create as draft Additional Salary entries) the THR due on `payment_date`."""
	if not frappe.has_permission("Additional Salary", "create"):
		frappe.throw(_("You are not permitted to create Additional Salary entries."), frappe.PermissionError)
	payment_date = getdate(payment_date)
	filters = {"status": "Active"} | ({"company": company} if company else {})
	rows = []
	for emp in frappe.get_all("Employee", filters=filters, fields=["name", "employee_name", "date_of_joining", "company"]):
		months = thr_months(emp.date_of_joining, payment_date)
		wage = _monthly_wage(emp.name)
		amount = thr_amount(wage, months)
		exists = frappe.db.exists(
			"Additional Salary",
			{"employee": emp.name, "salary_component": THR_COMPONENT, "payroll_date": payment_date, "docstatus": ["<", 2]},
		)
		rows.append({"employee": emp.name, "employee_name": emp.employee_name, "months": months, "monthly_wage": wage,
			"amount": amount, "skipped": "exists" if exists else ("no wage" if not wage else ("under 1 month" if not months else ""))})
		if cint(create) and amount and not exists:
			frappe.get_doc({
				"doctype": "Additional Salary", "employee": emp.name, "company": emp.company, "salary_component": THR_COMPONENT,
				"amount": amount, "payroll_date": payment_date, "overwrite_salary_structure_amount": 1,
			}).insert()
	return rows


def setup_thr_component():
	if not frappe.db.exists("Salary Component", THR_COMPONENT):
		frappe.get_doc({
			"doctype": "Salary Component", "salary_component": THR_COMPONENT, "salary_component_abbr": "THR", "type": "Earning",
			"is_tax_applicable": 1, "is_additional_component": 1, "depends_on_payment_days": 0,
		}).insert(ignore_permissions=True)


EMPLOYEE_FIELDS = {
	"Employee": [
		{"fieldname": "custom_identity_section", "label": "Identity & Social Security", "fieldtype": "Section Break", "insert_after": "blood_group"},
		{"fieldname": "custom_nik", "label": "NIK (KTP)", "fieldtype": "Data", "insert_after": "custom_identity_section"},
		{"fieldname": "custom_npwp", "label": "NPWP", "fieldtype": "Data", "insert_after": "custom_nik"},
		{"fieldname": "custom_identity_column", "fieldtype": "Column Break", "insert_after": "custom_npwp"},
		{"fieldname": "custom_bpjs_tk_no", "label": "BPJS Ketenagakerjaan No", "fieldtype": "Data", "insert_after": "custom_identity_column"},
		{"fieldname": "custom_bpjs_kes_no", "label": "BPJS Kesehatan No", "fieldtype": "Data", "insert_after": "custom_bpjs_tk_no"},
		{"fieldname": "custom_contract_type", "label": "Employment Agreement", "fieldtype": "Select", "options": "PKWTT\nPKWT",
			"default": "PKWTT", "insert_after": "contract_end_date",
			"description": "PKWTT is permanent, PKWT is fixed term (at most 5 years, no probation)."},
		{"fieldname": "custom_probation_months", "label": "Probation (months)", "fieldtype": "Int", "default": "0",
			"insert_after": "custom_contract_type", "description": "At most 3 months, and none for PKWT."},
	]
}


def setup_hr_compliance():
	from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

	create_custom_fields(EMPLOYEE_FIELDS, update=True)
	setup_thr_component()
	setup_payroll_specialist()
	setup_requisition_workflow()


PAYROLL_DOCTYPES = ("Payroll Entry", "Salary Slip", "Additional Salary", "Salary Structure Assignment", "Payroll Period")
PAYROLL_READ = ("Salary Component", "Salary Structure", "Employee", "Income Tax Slab")


def setup_payroll_specialist():
	"""Finance/payroll persona: runs payroll without being an HR manager."""
	from frappe.permissions import add_permission, update_permission_property

	role = "Payroll Specialist"
	if not frappe.db.exists("Role", role):
		frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1}).insert(ignore_permissions=True)
	for dt, ptypes in [(d, ("read", "write", "create", "submit", "cancel", "print", "export")) for d in PAYROLL_DOCTYPES] + [
		(d, ("read",)) for d in PAYROLL_READ
	]:
		if not frappe.db.exists("DocType", dt):
			continue
		add_permission(dt, role, 0)
		for ptype in ptypes:
			update_permission_property(dt, role, 0, ptype, 1)


def setup_requisition_workflow():
	"""Job Requisition: HR User drafts, HR Manager approves. Uses its own state field, so HRMS's `status` is untouched."""
	name = "Job Requisition Approval"
	if frappe.db.exists("Workflow", name) or not frappe.db.exists("DocType", "Job Requisition"):
		return
	for state in ("Draft", "Pending Approval", "Approved", "Rejected"):
		if not frappe.db.exists("Workflow State", state):
			frappe.get_doc({"doctype": "Workflow State", "workflow_state_name": state}).insert(ignore_permissions=True)
	for action in ("Submit for Approval", "Approve", "Reject"):
		if not frappe.db.exists("Workflow Action Master", action):
			frappe.get_doc({"doctype": "Workflow Action Master", "workflow_action_name": action}).insert(ignore_permissions=True)
	frappe.get_doc({
		"doctype": "Workflow", "workflow_name": name, "document_type": "Job Requisition", "is_active": 1,
		"workflow_state_field": "workflow_state", "send_email_alert": 0,
		"states": [
			{"state": "Draft", "doc_status": "0", "allow_edit": "HR User"},
			{"state": "Pending Approval", "doc_status": "0", "allow_edit": "HR Manager"},
			{"state": "Approved", "doc_status": "0", "allow_edit": "HR Manager"},
			{"state": "Rejected", "doc_status": "0", "allow_edit": "HR Manager"},
		],
		"transitions": [
			{"state": "Draft", "action": "Submit for Approval", "next_state": "Pending Approval", "allowed": "HR User"},
			{"state": "Pending Approval", "action": "Approve", "next_state": "Approved", "allowed": "HR Manager"},
			{"state": "Pending Approval", "action": "Reject", "next_state": "Rejected", "allowed": "HR Manager"},
		],
	}).insert(ignore_permissions=True)
