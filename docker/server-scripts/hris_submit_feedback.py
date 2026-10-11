# Server Script (type: API, method: hris_submit_feedback, allow_guest: 0)
# POST: employee, ratings ("kriteria|nilai;..." nilai 0..5 kelipatan 0.5, atau daftar JSON [{criteria,rating}]),
#       feedback (teks, wajib), submit (0 = simpan draft, 1 = kirim/submit).
# Membuat/memperbarui Employee Performance Feedback milik pemanggil untuk Appraisal karyawan itu (siklus aktif).
# Setelah disubmit tidak bisa diubah (417). Skor appraisal dihitung ulang oleh hrms saat submit.
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

fd = frappe.form_dict
text = (fd.get("feedback") or "").strip()
if not text:
    frappe.throw("Feedback text is required")
do_submit = str(fd.get("submit") or "0") == "1"
raw = fd.get("ratings")
given = {}
if isinstance(raw, list):
    for r in raw:
        given[str(r.get("criteria"))] = r.get("rating")
elif raw:
    for part in str(raw).split(";"):
        if part.strip():
            bits = part.split("|")
            if len(bits) != 2:
                frappe.throw("ratings must look like criteria|value;criteria|value")
            given[bits[0].strip()] = bits[1].strip()
rows = []
for c in criteria:
    if c["criteria"] not in given:
        frappe.throw("Missing rating for " + c["criteria"])
    v = frappe.utils.flt(given[c["criteria"]])
    if v < 0 or v > 5 or (v * 2) != int(v * 2):
        frappe.throw("Ratings must be between 0 and 5 in steps of 0.5")
    rows.append({"criteria": c["criteria"], "per_weightage": c["per_weightage"], "rating": v / 5.0})
for k in given:
    if k not in [c["criteria"] for c in criteria]:
        frappe.throw("Unknown criteria: " + k)
if mine and mine[0].docstatus == 1:
    frappe.throw("Feedback has already been submitted and cannot be changed")
if mine:
    doc = frappe.get_doc("Employee Performance Feedback", mine[0].name)
    doc.set("feedback_ratings", rows)
    doc.feedback = text
    doc.added_on = frappe.utils.now_datetime()
    doc.flags.ignore_permissions = True
    doc.save()
else:
    doc = frappe.get_doc({"doctype": "Employee Performance Feedback", "employee": target,
                          "company": frappe.db.get_value("Employee", target, "company"), "reviewer": caller[0].name,
                          "appraisal": appraisal, "appraisal_cycle": cycle, "added_on": frappe.utils.now_datetime(),
                          "feedback": text, "feedback_ratings": rows})
    doc.insert(ignore_permissions=True)
if do_submit:
    doc.flags.ignore_permissions = True
    doc.submit()
    target_user = frappe.db.get_value("Employee", target, "user_id")
    if target_user:
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": target_user,
                        "subject": "You received performance feedback from " + str(caller[0].employee_name),
                        "email_content": "Score: " + str(doc.total_score) + " / 5",
                        "document_type": "Employee Performance Feedback", "document_name": doc.name}
                       ).insert(ignore_permissions=True)
frappe.response["message"] = {"name": doc.name, "status": "submitted" if do_submit else "draft",
                              "total_score": doc.total_score,
                              "appraisal_final_score": frappe.db.get_value("Appraisal", appraisal, "final_score")}
