# Server Script (type: API, method: hris_get_wfh, allow_guest: 0)
# Jadwal/pengajuan WFH milik pemanggil, terbaru dulu, maks 50. ?scope=team: bawahan langsung (HR: semua).
# Hasil: [{"name","employee","employee_name","designation","from_date","to_date","days":[..],"reason","status":
#   "pending|approved|rejected","note"}]
user = frappe.session.user
scope = frappe.form_dict.get("scope")
me = frappe.get_all("Employee", filters={"user_id": user, "status": "Active"}, fields=["name"], limit_page_length=1)
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User", "role": ["in", ["HR User", "HR Manager"]]},
                   limit_page_length=1)) > 0
filters = {"enabled": 1}
ok = False
if scope == "team":
    if is_hr:
        ok = True
    elif me:
        team = [e.name for e in frappe.get_all("Employee", filters={"reports_to": me[0].name}, fields=["name"],
                                               limit_page_length=1000)]
        filters["employee"] = ["in", team or ["-"]]
        ok = True
elif me:
    filters["employee"] = me[0].name
    ok = True
valid = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
result = []
if ok:
    for q in frappe.get_all("WFH Schedule", filters=filters,
                            fields=["name", "employee", "employee_name", "from_date", "to_date", "reason", "status",
                                    "decision_note"] + valid,
                            order_by="from_date desc, creation desc", limit_page_length=50):
        result.append({"name": q.name, "employee": q.employee, "employee_name": q.employee_name,
                       "designation": frappe.db.get_value("Employee", q.employee, "designation"),
                       "from_date": str(q.from_date), "to_date": str(q.to_date),
                       "days": [d for d in valid if q.get(d)], "reason": q.reason or "",
                       "status": (q.status or "Approved").lower(), "note": q.decision_note})
frappe.response["message"] = result
