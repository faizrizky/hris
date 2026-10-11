# Server Script (type: DocType Event, doctype: File, event: Before Insert)
# Pemilik tidak boleh melampirkan file ke Employee Document berstatus Verified / Change Requested.
# Unggahan pemilik pada dokumen Rejected mengembalikan status ke Pending (untuk verifikasi ulang). HR bebas.
if doc.attached_to_doctype == "Employee Document" and doc.attached_to_name:
    user = frappe.session.user
    is_hr = user == "Administrator" or len(
        frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                            "role": ["in", ["HR User", "HR Manager", "System Manager"]]},
                       limit_page_length=1)
    ) > 0
    if not is_hr:
        status = frappe.db.get_value("Employee Document", doc.attached_to_name, "status")
        if status == "Verified" or status == "Change Requested":
            frappe.throw("This document is locked. Request a change and wait for HR approval before uploading a new file.",
                         frappe.PermissionError)
        if status == "Rejected":
            frappe.db.set_value("Employee Document", doc.attached_to_name, {"status": "Pending", "rejection_reason": None})
