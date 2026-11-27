# Server Script (type: DocType Event, doctype: Leave Encashment, event: After Submit)
# Notifikasi pencairan cuti disetujui.
target = frappe.db.get_value("Employee", doc.employee, "user_id")
if target:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                    "subject": "Your leave encashment was approved", "email_content": str(doc.leave_type),
                    "document_type": "Leave Encashment", "document_name": doc.name}).insert(ignore_permissions=True)
