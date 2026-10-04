# Server Script (type: API, method: hris_get_colleagues, allow_guest: 0)
# Rekan se-departemen dari pemanggil, tanpa dirinya sendiri. Memakai frappe.get_all
# (melewati User Permission) tetapi hanya mengembalikan field minimal.
# Panggil: GET /api/method/hris_get_colleagues
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name", "department"],
    limit_page_length=1,
)
if not me or not me[0].department:
    frappe.response["message"] = []
else:
    frappe.response["message"] = frappe.get_all(
        "Employee",
        filters={
            "department": me[0].department,
            "status": "Active",
            "name": ["!=", me[0].name],
        },
        fields=["name", "employee_name", "designation"],
        order_by="employee_name asc",
        limit_page_length=500,
    )
