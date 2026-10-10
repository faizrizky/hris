# Server Script (type: DocType Event, doctype: Salary Slip, event: After Submit)
# Notifikasi untuk karyawan ketika slip gaji di-submit.
target = frappe.db.get_value("Employee", doc.employee, "user_id")
if target:
    subject = "Your " + frappe.utils.formatdate(doc.start_date, "MMMM yyyy") + " payslip is available"
    if not frappe.db.exists(
        "Notification Log",
        {"for_user": target, "document_type": "Salary Slip", "document_name": doc.name},
    ):
        frappe.get_doc(
            {
                "doctype": "Notification Log",
                "type": "Alert",
                "for_user": target,
                "subject": subject,
                "email_content": "Net pay: " + str(doc.net_pay),
                "document_type": "Salary Slip",
                "document_name": doc.name,
            }
        ).insert(ignore_permissions=True)
