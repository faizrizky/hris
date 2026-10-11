# Server Script (type: DocType Event, doctype: HR Announcement, event: Before Save)
# Isi published_on otomatis saat pertama kali published.
if doc.published and not doc.published_on:
    doc.published_on = frappe.utils.now_datetime()
