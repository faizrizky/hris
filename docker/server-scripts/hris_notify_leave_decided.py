# Server Script (type: DocType Event, doctype: Leave Application, event: After Save)
# Notifikasi untuk pemohon ketika status berubah menjadi Approved / Rejected.
if (doc.status == "Approved" or doc.status == "Rejected") and doc.has_value_changed("status"):
    target = frappe.db.get_value("Employee", doc.employee, "user_id")
    if target:
        word = "approved" if doc.status == "Approved" else "rejected"
        subject = "Your leave request was " + word
        if not frappe.db.exists(
            "Notification Log",
            {"for_user": target, "document_type": "Leave Application", "document_name": doc.name, "subject": subject},
        ):
            frappe.get_doc(
                {
                    "doctype": "Notification Log",
                    "type": "Alert",
                    "for_user": target,
                    "subject": subject,
                    "email_content": str(doc.leave_type) + ": " + str(doc.from_date) + " to " + str(doc.to_date),
                    "document_type": "Leave Application",
                    "document_name": doc.name,
                }
            ).insert(ignore_permissions=True)
