# Server Script (type: DocType Event, doctype: Shift Request, event: After Insert)
# Notifikasi untuk approver saat shift diajukan.
if doc.approver and doc.approver != frappe.session.user:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": doc.approver,
                    "subject": "Shift request from " + str(doc.employee_name) + " is waiting for your approval",
                    "email_content": str(doc.shift_type) + ", from " + str(doc.from_date),
                    "document_type": "Shift Request", "document_name": doc.name}).insert(ignore_permissions=True)
