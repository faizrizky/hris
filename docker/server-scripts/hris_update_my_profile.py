# Server Script (type: API, method: hris_update_my_profile, allow_guest: 0)
# HANYA HR User / HR Manager (data dirinya sendiri). Karyawan lain: 403, harus mengajukan Profile Change Request
# (hris_submit_profile_change). POST body (semua opsional, hanya yang dikirim diubah):
#   phone, personal_email, address, em2_name, em2_relation, em2_phone,
#   emergency_contacts ("nama|relasi|telepon;..." atau daftar JSON), family ("nama|relasi|YYYY-MM-DD|0/1;..." atau JSON)
# Hasil: profil terbaru (bentuk hris_get_my_profile).
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
if not is_hr:
    frappe.throw("Personal data is managed by HR. Submit a change request instead.", frappe.PermissionError)
me = frappe.get_all("Employee", filters={"user_id": user, "status": "Active"}, fields=["name"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
target_emp = me[0].name
# @include: _lib/profile_input.py
# @include: _lib/profile_apply.py
fam = []
deps = 0
for m in frappe.get_all("Employee Family Member", filters={"parent": me[0].name, "parenttype": "Employee"},
                        fields=["member_name", "relation", "date_of_birth", "is_dependent"], order_by="idx asc",
                        parent_doctype="Employee", limit_page_length=20):
    fam.append({"member_name": m.member_name, "relation": m.relation,
                "date_of_birth": str(m.date_of_birth) if m.date_of_birth else None,
                "is_dependent": 1 if m.is_dependent else 0})
    if m.is_dependent and m.relation != "Spouse":
        deps = deps + 1
if deps > 3:
    deps = 3
e = frappe.get_all(
    "Employee",
    filters={"name": me[0].name},
    fields=[
        "employee_name", "date_of_birth", "gender", "marital_status", "company_email",
        "personal_email", "cell_number", "current_address", "permanent_address",
        "person_to_be_contacted", "relation", "emergency_phone_number",
        "custom_em2_name", "custom_em2_relation", "custom_em2_phone",
    ],
    limit_page_length=1,
)[0]
frappe.response["message"] = {
    "employee_name": e.employee_name,
    "date_of_birth": str(e.date_of_birth) if e.date_of_birth else None,
    "place_of_birth": None,
    "gender": e.gender,
    "marital_status": e.marital_status,
    "religion": None,
    "company_email": e.company_email,
    "personal_email": e.personal_email,
    "cell_number": e.cell_number,
    "current_address": e.current_address,
    "permanent_address": e.permanent_address,
    "emergency": {"name": e.person_to_be_contacted, "relation": e.relation, "phone": e.emergency_phone_number},
    "em2": {"name": e.custom_em2_name, "relation": e.custom_em2_relation, "phone": e.custom_em2_phone},
    "family": fam,
    "can_edit_directly": True,
    "pending_change": None,
    "ptkp_status": ("K/" if e.marital_status == "Married" else "TK/") + str(deps),
    "emergency_contacts": [
        {"contact_name": c.contact_name, "relation": c.relation, "phone": c.phone}
        for c in frappe.get_all("Employee Emergency Contact", filters={"parent": me[0].name, "parenttype": "Employee"},
                                fields=["contact_name", "relation", "phone"], order_by="idx asc",
                                parent_doctype="Employee", limit_page_length=20)
    ],
}
