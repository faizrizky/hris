# Server Script (type: DocType Event, doctype: Employee Promotion, event: After Submit)
# Notifikasi promosi.
target = frappe.db.get_value("Employee", doc.employee, "user_id")
if target:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                    "subject": "Your promotion has been recorded", "email_content": "Effective date: " + str(doc.promotion_date),
                    "document_type": "Employee Promotion", "document_name": doc.name}).insert(ignore_permissions=True)
