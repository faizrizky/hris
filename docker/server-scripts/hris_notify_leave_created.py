# Server Script (type: DocType Event, doctype: Leave Application, event: After Insert)
# Notifikasi (Notification Log, type Alert: tidak mengirim email) untuk leave approver.
approver = doc.leave_approver
if approver:
    subject = "Leave request from " + str(doc.employee_name) + " is waiting for your approval"
    if not frappe.db.exists(
        "Notification Log",
        {"for_user": approver, "document_type": "Leave Application", "document_name": doc.name, "subject": subject},
    ):
        frappe.get_doc(
            {
                "doctype": "Notification Log",
                "type": "Alert",
                "for_user": approver,
                "subject": subject,
                "email_content": str(doc.leave_type) + ": " + str(doc.from_date) + " to " + str(doc.to_date),
                "document_type": "Leave Application",
                "document_name": doc.name,
            }
        ).insert(ignore_permissions=True)
