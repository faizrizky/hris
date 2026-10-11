# Server Script (type: API, method: hris_get_profile_changes_for_review, allow_guest: 0)
# Hanya HR User / HR Manager (selain itu 403). ?status=Pending (default) | Approved | Rejected | all.
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
if not is_hr:
    frappe.throw("Only HR can review profile changes", frappe.PermissionError)
status = frappe.form_dict.get("status") or "Pending"
if status not in ("Pending", "Approved", "Rejected", "all"):
    frappe.throw("status must be Pending, Approved, Rejected or all")
filters = {}
if status != "all":
    filters["status"] = status
result = []
for q in frappe.get_all("Profile Change Request", filters=filters,
                        fields=["name", "employee", "employee_name", "status", "reason", "hr_note", "changes",
                                "creation", "decided_on"], order_by="creation desc", limit_page_length=200):
    emp = frappe.db.get_value("Employee", q.employee, ["designation", "department"], as_dict=True) or {}
    result.append({"name": q.name, "employee": q.employee, "employee_name": q.employee_name,
                   "designation": emp.get("designation"), "department": emp.get("department"),
                   "status": q.status, "reason": q.reason, "hr_note": q.hr_note,
                   "changes": json.loads(q.changes) if q.changes else [],
                   "created_on": str(q.creation)[:19].replace(" ", "T"),
                   "decided_on": str(q.decided_on)[:19].replace(" ", "T") if q.decided_on else None})
frappe.response["message"] = result
