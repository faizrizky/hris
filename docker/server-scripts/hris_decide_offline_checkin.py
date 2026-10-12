# Server Script (type: API, method: hris_decide_offline_checkin, allow_guest: 0)
# POST: name, decision (approve | reject), note (opsional). Atasan langsung atau HR; bukan karyawan itu sendiri.
# approve: time diganti ke custom_claimed_time (wajib ada; 417 "No claimed time to approve"). Attendance yang sudah
# terbentuk dari check-in itu dibatalkan terlebih dulu (Attendance bawaan hrms mengunci perubahan time); auto attendance
# membuat ulang pada proses berikutnya. reject: review Rejected, time tetap jam server.
user = frappe.session.user
name = frappe.form_dict.get("name")
decision = frappe.form_dict.get("decision")
note = (frappe.form_dict.get("note") or "").strip()
if decision != "approve" and decision != "reject":
    frappe.throw("decision must be approve or reject")
if not name or not frappe.db.exists("Employee Checkin", name):
    frappe.throw("Check-in not found")
ci = frappe.get_doc("Employee Checkin", name)
if not ci.custom_offline or ci.custom_review_status != "Needs Review":
    frappe.throw("This check-in is not waiting for review")
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
mine = frappe.get_all("Employee", filters={"user_id": user}, fields=["name"], limit_page_length=1)
if mine and mine[0].name == ci.employee and user != "Administrator":
    frappe.throw("You cannot review your own check-in", frappe.PermissionError)
allowed = is_hr
if not allowed:
    boss = frappe.db.get_value("Employee", ci.employee, "reports_to")
    if boss:
        allowed = frappe.db.get_value("Employee", boss, "user_id") == user
if not allowed:
    frappe.throw("You are not the direct supervisor of this employee", frappe.PermissionError)
if decision == "approve":
    if not ci.custom_claimed_time:
        frappe.throw("No claimed time to approve")
    claimed = str(ci.custom_claimed_time)[:19]
    if ci.attendance:
        att = frappe.get_doc("Attendance", ci.attendance)
        att.flags.ignore_permissions = True
        if att.docstatus == 1:
            att.cancel()
        ci.reload()
    ci.time = claimed
    ci.custom_review_status = "Approved"
    ci.custom_reviewed_by = user
    ci.custom_reviewed_on = frappe.utils.now_datetime()
    ci.flags.ignore_permissions = True
    ci.save()
    word = "approved"
else:
    ci.custom_review_status = "Rejected"
    ci.custom_reviewed_by = user
    ci.custom_reviewed_on = frappe.utils.now_datetime()
    ci.flags.ignore_permissions = True
    ci.save()
    word = "rejected"
target = frappe.db.get_value("Employee", ci.employee, "user_id")
if target:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target,
                    "subject": "Your offline check-in was " + word,
                    "email_content": note or str(ci.log_type) + " at " + str(ci.time)[:16],
                    "document_type": "Employee Checkin", "document_name": name}).insert(ignore_permissions=True)
frappe.response["message"] = {"name": name, "review_status": ci.custom_review_status, "time": str(ci.time)[:19],
                              "reviewed_by": user}
