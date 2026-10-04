# Server Script (type: API, method: hris_get_my_roles, allow_guest: 0)
# Role milik pemanggil (sesi atau token). frappe.get_roles() tidak tersedia di sandbox
# Server Script, jadi dibaca dari Has Role lalu ditambah role otomatis "All" dan "Guest".
# Panggil: GET /api/method/hris_get_my_roles
assigned = frappe.get_all(
    "Has Role",
    filters={"parent": frappe.session.user, "parenttype": "User"},
    pluck="role",
    limit_page_length=500,
)
roles = ["All", "Guest"]
for r in assigned:
    if r not in roles:
        roles.append(r)
frappe.response["message"] = roles
