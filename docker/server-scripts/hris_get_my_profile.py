# Server Script (type: API, method: hris_get_my_profile, allow_guest: 0)
# Profil pribadi pemanggil (Employee.user_id = session user). Tanpa NIK/NPWP/PTKP (tidak ada sumbernya).
# place_of_birth dan religion tidak ada di Employee v16, jadi selalu null. family belum ada sumber: [].
# Panggil: GET /api/method/hris_get_my_profile
fields = [
    "name", "employee_name", "date_of_birth", "gender", "marital_status", "company_email",
    "personal_email", "cell_number", "current_address", "permanent_address",
    "person_to_be_contacted", "relation", "emergency_phone_number",
    "custom_em2_name", "custom_em2_relation", "custom_em2_phone",
]
rows = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=fields,
    limit_page_length=1,
)
result = None
if rows:
    e = rows[0]
    result = {
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
        "emergency": {
            "name": e.person_to_be_contacted,
            "relation": e.relation,
            "phone": e.emergency_phone_number,
        },
        "em2": {
            "name": e.custom_em2_name,
            "relation": e.custom_em2_relation,
            "phone": e.custom_em2_phone,
        },
        "family": [],
        "emergency_contacts": [
            {"contact_name": c.contact_name, "relation": c.relation, "phone": c.phone}
            for c in frappe.get_all("Employee Emergency Contact",
                                    filters={"parent": rows[0].name, "parenttype": "Employee"},
                                    fields=["contact_name", "relation", "phone"], order_by="idx asc",
                                    parent_doctype="Employee", limit_page_length=20)
        ],
    }
frappe.response["message"] = result
