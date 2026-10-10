# Server Script (type: API, method: hris_get_my_language, allow_guest: 0)
# Bahasa pemanggil: User.language; kosong -> System Settings.language; kosong -> "en".
lang = frappe.db.get_value("User", frappe.session.user, "language")
if not lang:
    lang = frappe.db.get_single_value("System Settings", "language")
frappe.response["message"] = {"language": lang or "en"}
