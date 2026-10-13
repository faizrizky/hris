# Server Script (type: API, method: hris_decide_wfh, allow_guest: 0)
# POST: name, decision ("approve" | "reject"), note (opsional). Hanya atasan langsung pemohon atau
# HR User/Manager, bukan untuk pengajuan milik sendiri. Hanya status Pending.
user = frappe.session.user
name = frappe.form_dict.get("name")
decision = frappe.form_dict.get("decision")
note = (frappe.form_dict.get("note") or "").strip()
if decision != "approve" and decision != "reject":
    frappe.throw("decision must be approve or reject")
if not name or not frappe.db.exists("WFH Schedule", name):
    frappe.throw("WFH request not found")
req = frappe.get_doc("WFH Schedule", name)
if req.status != "Pending":
    frappe.throw("This WFH request has already been decided")
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User", "role": ["in", ["HR User", "HR Manager"]]},
                   limit_page_length=1)) > 0
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
status = "Approved" if decision == "approve" else "Rejected"
frappe.db.set_value("WFH Schedule", name, {"status": status, "decision_note": note or None, "decided_by": user})
target = frappe.db.get_value("Employee", req.employee, "user_id")
if target:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                    "subject": "Your WFH request was " + status.lower(),
                    "email_content": (note + " - " if note else "") + str(req.from_date) + " to " + str(req.to_date),
                    "document_type": "WFH Schedule", "document_name": name}).insert(ignore_permissions=True)
frappe.response["message"] = {"name": name, "status": status.lower()}
