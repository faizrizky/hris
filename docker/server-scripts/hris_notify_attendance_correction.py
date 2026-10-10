# Server Script (type: DocType Event, doctype: Attendance Request, event: After Submit)
# Notifikasi untuk pemohon ketika koreksi absensi disetujui (penolakan dibuat oleh
# hris_decide_attendance_correction karena penolakan tidak men-submit dokumen).
target = frappe.db.get_value("Employee", doc.employee, "user_id")
if target:
    subject = "Your attendance correction was approved"
    if not frappe.db.exists(
        "Notification Log",
        {"for_user": target, "document_type": "Attendance Request", "document_name": doc.name, "subject": subject},
    ):
        frappe.get_doc(
            {
                "doctype": "Notification Log",
                "type": "Alert",
                "for_user": target,
                "subject": subject,
                "email_content": "Attendance date: " + str(doc.from_date),
                "document_type": "Attendance Request",
                "document_name": doc.name,
            }
        ).insert(ignore_permissions=True)
