# Server Script (type: DocType Event, doctype: Employee Document, event: After Save)
# Notifikasi ke karyawan ketika HR mengubah status menjadi Verified / Rejected.
prev = doc.get_doc_before_save()
if (doc.status == "Verified" or doc.status == "Rejected") and doc.has_value_changed("status") and not (prev and prev.status == "Change Requested"):
    target = frappe.db.get_value("Employee", doc.employee, "user_id")
    if target:
        word = "verified" if doc.status == "Verified" else "rejected"
        subject = "Your document \"" + str(doc.document_name) + "\" was " + word
        if not frappe.db.exists("Notification Log", {"for_user": target, "document_type": "Employee Document",
                                                       "document_name": doc.name, "subject": subject}):
            frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target, "subject": subject,
                            "email_content": str(doc.category) + ((": " + str(doc.rejection_reason)) if doc.status == "Rejected" and doc.rejection_reason else ""), "document_type": "Employee Document",
                            "document_name": doc.name}).insert(ignore_permissions=True)
