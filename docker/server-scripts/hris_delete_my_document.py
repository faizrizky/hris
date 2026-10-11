# Server Script (type: API, method: hris_delete_my_document, allow_guest: 0)
# POST: name. Hapus Employee Document milik pemanggil HANYA bila status Pending dan belum ada File terlampir
# (dipakai aplikasi bila upload_file gagal setelah hris_create_my_document). Notification Log terkait ikut dihapus.
name = frappe.form_dict.get("name")
if not name or not frappe.db.exists("Employee Document", name):
    frappe.throw("Document not found")
doc_emp = frappe.db.get_value("Employee Document", name, "employee")
if not doc_emp or frappe.db.get_value("Employee", doc_emp, "user_id") != frappe.session.user:
    frappe.throw("You can only delete your own documents", frappe.PermissionError)
if frappe.db.get_value("Employee Document", name, "status") != "Pending":
    frappe.throw("Only pending documents can be deleted")
if frappe.db.count("File", {"attached_to_doctype": "Employee Document", "attached_to_name": name}) > 0:
    frappe.throw("Documents with an uploaded file cannot be deleted")
for n in frappe.get_all("Notification Log", filters={"document_type": "Employee Document", "document_name": name},
                        pluck="name", limit_page_length=100):
    frappe.delete_doc("Notification Log", n, ignore_permissions=True, force=True)
frappe.delete_doc("Employee Document", name, ignore_permissions=True, force=True)
frappe.response["message"] = {"name": name, "deleted": True}
