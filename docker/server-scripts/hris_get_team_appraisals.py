# Server Script (type: API, method: hris_get_team_appraisals, allow_guest: 0)
# Appraisal tim di siklus aktif: atasan -> bawahan langsung; HR -> semua karyawan yang punya Appraisal.
# Item: employee, employee_name, designation, appraisal, cycle, final_score, my_feedback_status
# (none|draft|submitted), my_feedback_score.
user = frappe.session.user
caller = frappe.get_all("Employee", filters={"user_id": user, "status": "Active"}, fields=["name", "employee_name"],
                        limit_page_length=1)
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
cycles = frappe.get_all("Appraisal Cycle", filters={"status": "In Progress"}, fields=["name"],
                        order_by="start_date desc", limit_page_length=1)
cycle = cycles[0].name if cycles else None

if not is_hr and not caller:
    frappe.throw("This account is not linked to an active employee", frappe.PermissionError)
filters = {"appraisal_cycle": cycle, "docstatus": ["<", 2]}
if not is_hr:
    if frappe.db.count("Employee", {"reports_to": caller[0].name, "status": "Active"}) == 0:
        frappe.throw("Only supervisors and HR can view team appraisals", frappe.PermissionError)
    team = [e.name for e in frappe.get_all("Employee", filters={"reports_to": caller[0].name, "status": "Active"},
                                           fields=["name"], limit_page_length=500)]
    filters["employee"] = ["in", team or ["-"]]
result = []
if cycle:
    for a in frappe.get_all("Appraisal", filters=filters,
                            fields=["name", "employee", "employee_name", "designation", "final_score"],
                            order_by="employee_name asc", limit_page_length=500):
        if caller and a.employee == caller[0].name:
            continue
        fb = frappe.get_all("Employee Performance Feedback",
                            filters={"appraisal": a.name, "reviewer": caller[0].name if caller else "-",
                                     "docstatus": ["<", 2]},
                            fields=["docstatus", "total_score"], limit_page_length=1)
        status = "none"
        score = None
        if fb:
            status = "submitted" if fb[0].docstatus == 1 else "draft"
            score = fb[0].total_score
        result.append({"employee": a.employee, "employee_name": a.employee_name, "designation": a.designation,
                       "appraisal": a.name, "cycle": cycle, "final_score": a.final_score,
                       "my_feedback_status": status, "my_feedback_score": score})
frappe.response["message"] = result
