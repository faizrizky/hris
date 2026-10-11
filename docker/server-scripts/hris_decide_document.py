# Server Script (type: API, method: hris_decide_document, allow_guest: 0)
# POST: name, decision (verify | reject | allow_change | deny_change), reason (wajib bila reject; opsional deny_change).
# Hanya HR User / HR Manager. verify hanya untuk dokumen yang punya file. allow_change / deny_change hanya untuk
# status "Change Requested": allow -> Pending (verified_by dikosongkan, file lama tetap), deny -> kembali Verified.
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
if decision not in ("verify", "reject", "allow_change", "deny_change"):
    frappe.throw("decision must be verify, reject, allow_change or deny_change")
if not name or not frappe.db.exists("Employee Document", name):
    frappe.throw("Document not found")
if decision == "reject" and not reason:
    frappe.throw("A reason is required when rejecting a document")
has_file = frappe.db.count("File", {"attached_to_doctype": "Employee Document", "attached_to_name": name}) > 0
if decision == "verify" and not has_file:
    frappe.throw("Only documents with an uploaded file can be verified")
doc = frappe.get_doc("Employee Document", name)
if decision == "allow_change" or decision == "deny_change":
    if doc.status != "Change Requested":
        frappe.throw("This document has no pending change request")
    target = frappe.db.get_value("Employee", doc.employee, "user_id")
    if decision == "allow_change":
        doc.status = "Pending"
        doc.verified_by = None
        msg = "Your change request for \"" + str(doc.document_name) + "\" was approved. You can upload a new file."
        body = "Upload a new file; HR will verify it again."
    else:
        doc.status = "Verified"
        msg = "Your change request for \"" + str(doc.document_name) + "\" was denied"
        body = reason or "No reason given"
    doc.flags.ignore_permissions = True
    doc.save()
    if target:
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target, "subject": msg,
                        "email_content": body, "document_type": "Employee Document",
                        "document_name": name}).insert(ignore_permissions=True)
    frappe.response["message"] = {"name": name, "status": doc.status, "verified_by": doc.verified_by,
                                  "rejection_reason": doc.rejection_reason}
else:
    doc.status = "Verified" if decision == "verify" else "Rejected"
    doc.verified_by = user
    doc.rejection_reason = reason if decision == "reject" else None
    doc.flags.ignore_permissions = True
    doc.save()
    frappe.response["message"] = {"name": name, "status": doc.status, "verified_by": user,
                                  "rejection_reason": doc.rejection_reason}
