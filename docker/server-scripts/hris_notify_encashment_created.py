# Server Script (type: DocType Event, doctype: Leave Encashment, event: After Insert)
# Notifikasi HR saat pencairan cuti diajukan.
sent = [frappe.session.user, "Administrator"]
for u in frappe.get_all("Has Role", filters={"role": ["in", ["HR Manager", "HR User"]], "parenttype": "User"},
                        pluck="parent", limit_page_length=100):
    if u not in sent:
        sent.append(u)
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": u,
                        "subject": "Leave encashment from " + str(doc.employee_name) + " is waiting for review", "email_content": str(doc.leave_type),
                        "document_type": "Leave Encashment", "document_name": doc.name}).insert(ignore_permissions=True)
