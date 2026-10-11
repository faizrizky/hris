# Server Script (type: API, method: hris_unregister_push_token, allow_guest: 0)
# POST: token. Hanya menghapus token milik pemanggil.
token = (frappe.form_dict.get("token") or "").strip()
removed = False
if token and frappe.db.exists("Push Token", {"name": token, "user": frappe.session.user}):
    frappe.delete_doc("Push Token", token, ignore_permissions=True, force=True)
    removed = True
frappe.response["message"] = {"token": token, "removed": removed}
