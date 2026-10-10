# Server Script (type: API, method: hris_decide_travel_request, allow_guest: 0)
# POST body: name, decision ("approve" | "reject"). Hanya atasan langsung pemohon atau HR User/Manager,
# dan bukan untuk dokumen milik sendiri. approve = submit Travel Request; reject = custom_rejected=1.
user = frappe.session.user
name = frappe.form_dict.get("name")
decision = frappe.form_dict.get("decision")
if decision != "approve" and decision != "reject":
    frappe.throw("decision must be approve or reject")
if not name or not frappe.db.exists("Travel Request", name):
    frappe.throw("Travel request not found")
req = frappe.get_doc("Travel Request", name)
if req.docstatus != 0 or req.custom_rejected:
    frappe.throw("This travel request has already been decided")
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
if decision == "reject":
    frappe.db.set_value("Travel Request", name, "custom_rejected", 1)
    status = "rejected"
else:
    req.flags.ignore_permissions = True
    req.submit()
    status = "approved"
target = frappe.db.get_value("Employee", req.employee, "user_id")
if target:
    frappe.get_doc(
        {
            "doctype": "Notification Log",
            "type": "Alert",
            "for_user": target,
            "subject": "Your travel request was " + status,
            "email_content": str(req.custom_destination) + ": " + str(req.custom_from_date) + " to " + str(req.custom_to_date),
            "document_type": "Travel Request",
            "document_name": name,
        }
    ).insert(ignore_permissions=True)
frappe.response["message"] = {"name": name, "status": status}
