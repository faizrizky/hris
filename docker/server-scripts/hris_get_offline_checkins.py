# Server Script (type: API, method: hris_get_offline_checkins, allow_guest: 0)
# GET ?status=Needs Review (default) | Approved | Rejected | all, ?scope=team (atasan: bawahan langsung).
# HR User/Manager melihat semua; atasan hanya bawahan langsung; karyawan lain 403. Check-in offline saja.
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
me = frappe.get_all("Employee", filters={"user_id": user, "status": "Active"}, fields=["name"], limit_page_length=1)
team = []
if me:
    team = [e.name for e in frappe.get_all("Employee", filters={"reports_to": me[0].name, "status": "Active"},
                                           fields=["name"], limit_page_length=500)]
if not is_hr and not team:
    frappe.throw("Only supervisors and HR can review offline check-ins", frappe.PermissionError)
status = frappe.form_dict.get("status") or "Needs Review"
if status not in ("Needs Review", "Approved", "Rejected", "all"):
    frappe.throw("status must be Needs Review, Approved, Rejected or all")
filters = {"custom_offline": 1}
if status != "all":
    filters["custom_review_status"] = status
if (not is_hr) or frappe.form_dict.get("scope") == "team":
    if not is_hr:
        filters["employee"] = ["in", team or ["-"]]
result = []
for c in frappe.get_all("Employee Checkin", filters=filters,
                        fields=["name", "employee", "employee_name", "log_type", "time", "custom_claimed_time",
                                "custom_flags", "custom_review_status", "custom_clock_skew_seconds",
                                "custom_queue_age_seconds", "custom_reviewed_by", "custom_reviewed_on",
                                "custom_timezone"],
                        order_by="creation desc", limit_page_length=200):
    result.append({"name": c.name, "employee": c.employee, "employee_name": c.employee_name,
                   "designation": frappe.db.get_value("Employee", c.employee, "designation"),
                   "log_type": c.log_type, "time": str(c.time)[:19],
                   "claimed_time": str(c.custom_claimed_time)[:19] if c.custom_claimed_time else None,
                   "flags": [x for x in (c.custom_flags or "").split("; ") if x],
                   "review_status": c.custom_review_status, "clock_skew_seconds": c.custom_clock_skew_seconds,
                   "queue_age_seconds": c.custom_queue_age_seconds, "timezone": c.custom_timezone,
                   "reviewed_by": c.custom_reviewed_by,
                   "reviewed_on": str(c.custom_reviewed_on)[:19] if c.custom_reviewed_on else None})
frappe.response["message"] = result
