# Server Script (type: API, method: hris_get_my_approver, allow_guest: 0)
# Leave approver milik pemanggil: {"email", "name"} atau null bila belum ada.
# Memakai frappe.get_all (melewati User Permission), hanya dua field yang dikembalikan.
# Panggil: GET /api/method/hris_get_my_approver
result = None
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["leave_approver"],
    limit_page_length=1,
)
if me and me[0].leave_approver:
    email = me[0].leave_approver
    emp = frappe.get_all(
        "Employee",
        filters={"user_id": email},
        fields=["employee_name"],
        limit_page_length=1,
    )
    if emp and emp[0].employee_name:
        full_name = emp[0].employee_name
    else:
        usr = frappe.get_all("User", filters={"name": email}, fields=["full_name"], limit_page_length=1)
        full_name = usr[0].full_name if usr else None
    result = {"email": email, "name": full_name}
frappe.response["message"] = result
