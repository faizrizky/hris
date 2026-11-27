# Server Script (type: DocType Event, doctype: Exit Interview, event: After Save)
# Notifikasi saat jadwal exit interview ditetapkan / diubah.
prev = doc.get_doc_before_save()
if doc.date and (not prev or str(prev.date) != str(doc.date)):
    target = frappe.db.get_value("Employee", doc.employee, "user_id")
    if target:
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                        "subject": "Your exit interview is scheduled", "email_content": "Date: " + str(doc.date),
                        "document_type": "Exit Interview", "document_name": doc.name}).insert(ignore_permissions=True)
