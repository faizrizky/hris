# Server Script (type: API, method: hris_decide_document, allow_guest: 0)
# POST: name, decision (verify | reject), reason (wajib bila reject). Hanya HR User / HR Manager.
# Hanya dokumen yang punya file yang boleh diverifikasi. Notifikasi ke karyawan lewat hris_notify_document_status.
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
if not is_hr:
    frappe.throw("Only HR can verify documents", frappe.PermissionError)
name = frappe.form_dict.get("name")
decision = frappe.form_dict.get("decision")
reason = (frappe.form_dict.get("reason") or "").strip()
if decision != "verify" and decision != "reject":
    frappe.throw("decision must be verify or reject")
if not name or not frappe.db.exists("Employee Document", name):
    frappe.throw("Document not found")
if decision == "reject" and not reason:
    frappe.throw("A reason is required when rejecting a document")
has_file = frappe.db.count("File", {"attached_to_doctype": "Employee Document", "attached_to_name": name}) > 0
if decision == "verify" and not has_file:
    frappe.throw("Only documents with an uploaded file can be verified")
doc = frappe.get_doc("Employee Document", name)
doc.status = "Verified" if decision == "verify" else "Rejected"
doc.verified_by = user
doc.rejection_reason = reason if decision == "reject" else None
doc.flags.ignore_permissions = True
doc.save()
frappe.response["message"] = {"name": name, "status": doc.status, "verified_by": user,
                              "rejection_reason": doc.rejection_reason}
