# Server Script (type: API, method: hris_request_document_change, allow_guest: 0)
# POST: name, reason (wajib). Pemilik meminta perubahan atas dokumen yang sudah Verified.
# Status menjadi "Change Requested"; HR diberi notifikasi. Keputusan HR lewat hris_decide_document.
name = frappe.form_dict.get("name")
reason = (frappe.form_dict.get("reason") or "").strip()
if not name or not frappe.db.exists("Employee Document", name):
    frappe.throw("Document not found")
emp = frappe.db.get_value("Employee Document", name, "employee")
if not emp or frappe.db.get_value("Employee", emp, "user_id") != frappe.session.user:
    frappe.throw("You can only request changes to your own documents", frappe.PermissionError)
if frappe.db.get_value("Employee Document", name, "status") != "Verified":
    frappe.throw("Changes can only be requested for verified documents")
if not reason:
    frappe.throw("A reason is required")
if len(reason) > 500:
    frappe.throw("Reason is too long (max 500 characters)")
frappe.db.set_value("Employee Document", name, {"status": "Change Requested", "change_reason": reason})
emp_name = frappe.db.get_value("Employee", emp, "employee_name")
doc_name = frappe.db.get_value("Employee Document", name, "document_name")
hr_users = frappe.get_all("Has Role", filters={"role": ["in", ["HR Manager", "HR User"]], "parenttype": "User"},
                          pluck="parent", limit_page_length=100)
sent = []
for u in hr_users:
    if u != "Administrator" and u not in sent:
        sent.append(u)
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": u,
                        "subject": str(emp_name) + " requested a change to \"" + str(doc_name) + "\"",
                        "email_content": reason, "document_type": "Employee Document",
                        "document_name": name}).insert(ignore_permissions=True)
frappe.response["message"] = {"name": name, "status": "Change Requested", "change_reason": reason}
