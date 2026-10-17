# Server Script (type: DocType Event, doctype: Registered Device, event: After Save)
# Notifikasi ke karyawan ketika HR menyetujui / menolak perangkatnya.
prev = doc.get_doc_before_save()
if prev and doc.has_value_changed("status") and (doc.status == "Approved" or doc.status == "Rejected"):
    target = frappe.db.get_value("Employee", doc.employee, "user_id")
    if target:
        word = "approved" if doc.status == "Approved" else "rejected"
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                        "subject": "Your device \"" + str(doc.device_name or doc.device_id) + "\" was " + word,
                        "email_content": str(doc.hr_note or ""), "document_type": "Registered Device",
                        "document_name": doc.name}).insert(ignore_permissions=True)

# "Ganti perangkat": HR menyetujui perangkat baru dengan centang Replace Previous Devices, sehingga perangkat lama milik
# karyawan yang sama otomatis dicabut (Rejected). Berguna saat karyawan berganti HP.
if doc.status == "Approved" and doc.get("replace_previous"):
    for o in frappe.get_all("Registered Device", filters={"employee": doc.employee, "status": "Approved",
                                                          "name": ["!=", doc.name]}, pluck="name", limit_page_length=50):
        frappe.db.set_value("Registered Device", o, "status", "Rejected")
    frappe.db.set_value("Registered Device", doc.name, "replace_previous", 0)
