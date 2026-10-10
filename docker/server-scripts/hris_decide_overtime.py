# Server Script (type: API, method: hris_decide_overtime, allow_guest: 0)
# POST: name, decision ("approve" | "reject"). Hanya atasan langsung pemohon atau HR User/Manager,
# bukan untuk lembur milik sendiri. Status "paid" diisi HR di web (setelah dibayar lewat payroll).
user = frappe.session.user
name = frappe.form_dict.get("name")
decision = frappe.form_dict.get("decision")
if decision != "approve" and decision != "reject":
    frappe.throw("decision must be approve or reject")
if not name or not frappe.db.exists("Overtime Request", name):
    frappe.throw("Overtime request not found")
req = frappe.get_doc("Overtime Request", name)
if req.status != "pending":
    frappe.throw("This overtime request has already been decided")
is_hr = user == "Administrator" or len(
    frappe.get_all(
        "Has Role",
        filters={"parent": user, "parenttype": "User", "role": ["in", ["HR User", "HR Manager"]]},
        limit_page_length=1,
    )
) > 0
allowed = is_hr
if not allowed:
    boss = frappe.db.get_value("Employee", req.employee, "reports_to")
    if boss:
        allowed = frappe.db.get_value("Employee", boss, "user_id") == user
mine = frappe.get_all("Employee", filters={"user_id": user}, fields=["name"], limit_page_length=1)
if mine and mine[0].name == req.employee and user != "Administrator":
    allowed = False
if not allowed:
    frappe.throw("You are not the direct supervisor of the requester", frappe.PermissionError)
status = "approved" if decision == "approve" else "rejected"
frappe.db.set_value("Overtime Request", name, "status", status)
target = frappe.db.get_value("Employee", req.employee, "user_id")
if target:
    frappe.get_doc(
        {
            "doctype": "Notification Log",
            "type": "Alert",
            "for_user": target,
            "subject": "Your overtime request was " + status,
            "email_content": str(req.date) + ": " + str(req.hours) + " hours",
            "document_type": "Overtime Request",
            "document_name": name,
        }
    ).insert(ignore_permissions=True)
frappe.response["message"] = {"name": name, "status": status}
