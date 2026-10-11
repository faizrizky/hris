# Server Script (type: API, method: hris_get_overtimes, allow_guest: 0)
# Lembur milik pemanggil, terbaru dulu, maks 50. ?scope=team: bawahan langsung (HR: semua) untuk persetujuan.
# Hasil: [{"name","date","start_minute","end_minute","hours","note","status":"pending|approved|paid|rejected"}]
user = frappe.session.user
scope = frappe.form_dict.get("scope")
me = frappe.get_all("Employee", filters={"user_id": user, "status": "Active"}, fields=["name"], limit_page_length=1)
is_hr = user == "Administrator" or len(
    frappe.get_all(
        "Has Role",
        filters={"parent": user, "parenttype": "User", "role": ["in", ["HR User", "HR Manager"]]},
        limit_page_length=1,
    )
) > 0
filters = {}
ok = False
if scope == "team":
    if is_hr:
        ok = True
    elif me:
        team = [e.name for e in frappe.get_all("Employee", filters={"reports_to": me[0].name}, fields=["name"], limit_page_length=1000)]
        filters["employee"] = ["in", team or ["-"]]
        ok = True
elif me:
    filters["employee"] = me[0].name
    ok = True
def minutes(t):
    p = str(t).split(":")
    return int(p[0]) * 60 + int(p[1])
result = []
if ok:
    for q in frappe.get_all(
        "Overtime Request",
        filters=filters,
        fields=["name", "employee", "employee_name", "date", "start_time", "end_time", "hours", "note", "status"],
        order_by="date desc, creation desc",
        limit_page_length=50,
    ):
        atts = []
        for f in frappe.get_all("File", filters={"attached_to_doctype": "Overtime Request", "attached_to_name": q.name},
                                fields=["file_name", "file_url"], order_by="creation asc", limit_page_length=20):
            atts.append({"file_name": f.file_name, "file_url": f.file_url})
        item = {
            "name": q.name,
            "date": str(q.date),
            "start_minute": minutes(q.start_time),
            "end_minute": minutes(q.end_time),
            "hours": q.hours,
            "note": q.note,
            "status": q.status,
            "attachments": atts,
        }
        if scope == "team":
            item["employee"] = q.employee
            item["employee_name"] = q.employee_name
        result.append(item)
frappe.response["message"] = result
