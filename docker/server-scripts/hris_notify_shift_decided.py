# Server Script (type: DocType Event, doctype: Shift Request, event: After Submit)
# Notifikasi keputusan shift untuk pemohon.
target = frappe.db.get_value("Employee", doc.employee, "user_id")
if target:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                    "subject": "Your shift request was " + doc.status.lower(), "email_content": str(doc.shift_type) + ", from " + str(doc.from_date),
                    "document_type": "Shift Request", "document_name": doc.name}).insert(ignore_permissions=True)
