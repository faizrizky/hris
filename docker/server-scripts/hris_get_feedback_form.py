# Server Script (type: API, method: hris_get_feedback_form, allow_guest: 0)
# GET ?employee=HR-EMP-xxxxx. Hanya atasan langsung karyawan itu atau HR (403 selain itu).
# Hasil: {"employee","employee_name","appraisal","cycle","criteria":[{criteria,per_weightage}],
#         "my_feedback":{"status","ratings":[{criteria,rating(0-5)}],"feedback","total_score"}|null,
#         "goals":[{name,progress}]}
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

target = frappe.form_dict.get("employee")
if not target or not frappe.db.exists("Employee", target):
    frappe.throw("employee is required and must exist")
allowed = is_hr or (caller and frappe.db.get_value("Employee", target, "reports_to") == caller[0].name)
if caller and caller[0].name == target:
    allowed = False
if not allowed:
    frappe.throw("You can only review your direct reports", frappe.PermissionError)
apr = frappe.get_all("Appraisal", filters={"employee": target, "appraisal_cycle": cycle, "docstatus": ["<", 2]},
                     fields=["name", "appraisal_template"], limit_page_length=1) if cycle else []
if not apr:
    frappe.throw("This employee has no appraisal in the active cycle")
appraisal = apr[0].name
crit = []
if apr[0].appraisal_template:
    crit = frappe.get_all("Employee Feedback Rating", filters={"parent": apr[0].appraisal_template,
                          "parenttype": "Appraisal Template"}, fields=["criteria", "per_weightage"],
                          order_by="idx asc", parent_doctype="Appraisal Template", limit_page_length=50)
if not crit:
    crit = frappe.get_all("Employee Feedback Rating", filters={"parent": appraisal, "parenttype": "Appraisal",
                          "parentfield": "self_ratings"}, fields=["criteria", "per_weightage"],
                          order_by="idx asc", parent_doctype="Appraisal", limit_page_length=50)
if not crit:
    names = frappe.get_all("Employee Feedback Criteria", pluck="name", limit_page_length=50)
    crit = [{"criteria": n, "per_weightage": round(100.0 / len(names), 2)} for n in names]
criteria = [{"criteria": c["criteria"], "per_weightage": c["per_weightage"]} for c in crit]
mine = frappe.get_all("Employee Performance Feedback",
                      filters={"appraisal": appraisal, "reviewer": caller[0].name if caller else "-", "docstatus": ["<", 2]},
                      fields=["name", "docstatus", "feedback", "total_score"], limit_page_length=1)

my = None
if mine:
    ratings = frappe.get_all("Employee Feedback Rating", filters={"parent": mine[0].name,
                             "parenttype": "Employee Performance Feedback"}, fields=["criteria", "rating"],
                             order_by="idx asc", parent_doctype="Employee Performance Feedback", limit_page_length=50)
    my = {"name": mine[0].name, "status": "submitted" if mine[0].docstatus == 1 else "draft",
          "ratings": [{"criteria": r.criteria, "rating": round((r.rating or 0) * 5, 2)} for r in ratings],
          "feedback": frappe.utils.strip_html(mine[0].feedback) if mine[0].feedback else "",
          "total_score": mine[0].total_score}
goals = [{"name": g.goal_name, "progress": g.progress or 0}
         for g in frappe.get_all("Goal", filters={"employee": target, "appraisal_cycle": cycle},
                                 fields=["goal_name", "progress"], order_by="creation asc", limit_page_length=100)]
frappe.response["message"] = {"employee": target, "employee_name": frappe.db.get_value("Employee", target, "employee_name"),
                              "appraisal": appraisal, "cycle": cycle, "criteria": criteria, "my_feedback": my,
                              "goals": goals}
