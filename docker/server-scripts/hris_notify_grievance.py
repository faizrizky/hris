# Server Script (type: DocType Event, doctype: Employee Grievance, event: After Save)
# Pengaduan baru -> HR; perubahan status -> pelapor.
prev = doc.get_doc_before_save()
if not prev:
    sent = [frappe.session.user, "Administrator"]
    for u in frappe.get_all("Has Role", filters={"role": ["in", ["HR Manager", "HR User"]], "parenttype": "User"},
                            pluck="parent", limit_page_length=100):
        if u not in sent:
            sent.append(u)
            frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": u,
                            "subject": "A new grievance is waiting for review", "email_content": str(doc.subject),
                            "document_type": "Employee Grievance", "document_name": doc.name}).insert(ignore_permissions=True)
elif prev.status != doc.status:
    target = frappe.db.get_value("Employee", doc.raised_by, "user_id")
    if target:
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                        "subject": "Your grievance is now " + doc.status.lower(), "email_content": str(doc.subject),
                        "document_type": "Employee Grievance", "document_name": doc.name}).insert(ignore_permissions=True)
