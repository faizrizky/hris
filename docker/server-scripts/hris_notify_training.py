# Server Script (type: DocType Event, doctype: Training Event, event: After Submit)
# Notifikasi peserta pelatihan.
for row in doc.employees:
    target = frappe.db.get_value("Employee", row.employee, "user_id")
    if target:
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                        "subject": "You are enrolled in training: " + str(doc.event_name),
                        "email_content": "Starts: " + str(doc.start_time)[:16],
                        "document_type": "Training Event", "document_name": doc.name}).insert(ignore_permissions=True)
