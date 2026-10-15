# Pustaka pengikatan perangkat (disisipkan lewat "# @include: _lib/device_lib.py").
# Perangkat pertama karyawan otomatis Approved; perangkat berikutnya Pending sampai HR menyetujui.
def dv_notify_hr(emp_name, emp_label, dev_name, docname):
    for u in frappe.get_all("Has Role", filters={"role": ["in", ["HR Manager", "HR User"]], "parenttype": "User"},
                            pluck="parent", limit_page_length=100):
        if u != "Administrator" and u != frappe.session.user:
            frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": u,
                            "subject": "New device awaiting approval: " + str(emp_label),
                            "email_content": str(dev_name or ""), "document_type": "Registered Device",
                            "document_name": docname}).insert(ignore_permissions=True)

def dv_resolve(emp_name, emp_label, device_id, dev_name, platform):
    # Hasil: "Approved" | "Pending" | "Rejected" | "Unknown" (aplikasi lama tanpa device_id)
    device_id = (device_id or "").strip()[:140]
    if not device_id:
        return "Unknown"
    rows = frappe.get_all("Registered Device", filters={"employee": emp_name},
                          fields=["name", "device_id", "status"], limit_page_length=50)
    for r in rows:
        if r.device_id == device_id:
            frappe.db.set_value("Registered Device", r.name, "last_seen", frappe.utils.now_datetime())
            return r.status
    first = not [r for r in rows if r.status != "Rejected"]
    d = frappe.get_doc({"doctype": "Registered Device", "employee": emp_name, "device_id": device_id,
                        "device_name": (dev_name or "")[:140], "platform": (platform or "")[:20],
                        "status": "Approved" if first else "Pending",
                        "registered_on": frappe.utils.now_datetime(), "last_seen": frappe.utils.now_datetime()})
    d.insert(ignore_permissions=True)
    if not first:
        dv_notify_hr(emp_name, emp_label, dev_name, d.name)
    return d.status
