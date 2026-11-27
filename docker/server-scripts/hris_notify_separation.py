# Server Script (type: DocType Event, doctype: Employee Separation, event: After Submit)
# Notifikasi proses resign / PHK.
target = frappe.db.get_value("Employee", doc.employee, "user_id")
if target:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                    "subject": "Your separation process has started", "email_content": "Please check with HR for the next steps",
                    "document_type": "Employee Separation", "document_name": doc.name}).insert(ignore_permissions=True)
