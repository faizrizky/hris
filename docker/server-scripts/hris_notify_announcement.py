# Server Script (type: DocType Event, doctype: HR Announcement, event: After Save)
# Notifikasi sekali saja ke semua karyawan aktif yang termasuk audience saat pengumuman pertama kali published.
if doc.published and not frappe.db.exists("Notification Log", {"document_type": "HR Announcement",
                                                                 "document_name": doc.name}):
    for e in frappe.get_all("Employee", filters={"status": "Active", "user_id": ["is", "set"]},
                            fields=["user_id", "department"], limit_page_length=5000):
        if doc.audience == "Department" and e.department != doc.department:
            continue
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": e.user_id,
                        "subject": doc.title, "email_content": frappe.utils.strip_html(doc.content or "")[:300],
                        "document_type": "HR Announcement", "document_name": doc.name}
                       ).insert(ignore_permissions=True)
