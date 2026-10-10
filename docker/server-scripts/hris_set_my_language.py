# Server Script (type: API, method: hris_set_my_language, allow_guest: 0)
# POST body: language (kode bahasa yang Enabled di doctype Language, mis. "en" / "id").
# Hanya mengubah User.language milik pemanggil. 417 bila kode tidak dikenal / tidak aktif.
lang = frappe.form_dict.get("language")
if not lang or not frappe.db.get_value("Language", lang, "enabled"):
    frappe.throw("Language is not enabled: " + str(lang))
frappe.db.set_value("User", frappe.session.user, "language", lang)
frappe.response["message"] = {"language": lang}
