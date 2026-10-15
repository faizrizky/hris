# Server Script (type: DocType Event, doctype: Registered Device, event: After Save)
# Notifikasi ke karyawan ketika HR menyetujui / menolak perangkatnya.
prev = doc.get_doc_before_save()
if prev and doc.has_value_changed("status") and (doc.status == "Approved" or doc.status == "Rejected"):
    target = frappe.db.get_value("Employee", doc.employee, "user_id")
    if target:
        word = "approved" if doc.status == "Approved" else "rejected"
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                        "subject": "Your device \"" + str(doc.device_name or doc.device_id) + "\" was " + word,
                        "email_content": str(doc.hr_note or ""), "document_type": "Registered Device",
                        "document_name": doc.name}).insert(ignore_permissions=True)
