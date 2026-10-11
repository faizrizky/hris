# Server Script (type: Permission Query, doctype: HR Announcement)
# Non-HR hanya boleh melihat pengumuman yang sudah published di daftar.
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager", "System Manager"]]},
                   limit_page_length=1)
) > 0
conditions = "" if is_hr else "`tabHR Announcement`.published = 1"
