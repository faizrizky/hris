# Server Script (type: API, method: hris_get_attendance_corrections, allow_guest: 0)
# Daftar koreksi absensi, terbaru dulu, maks 50.
#   (default)       : milik pemanggil
#   ?scope=team     : milik bawahan langsung (HR User/HR Manager: semua karyawan), untuk persetujuan
# Hasil: [{"name","date","check_in","check_out","reason","status":"pending|approved|rejected"}]
# (scope=team menambah "employee" dan "employee_name")
user = frappe.session.user
scope = frappe.form_dict.get("scope")
me = frappe.get_all(
    "Employee",
    filters={"user_id": user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)
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
        filters["employee"] = ["in", [e.name for e in frappe.get_all("Employee", filters={"reports_to": me[0].name}, fields=["name"], limit_page_length=1000)] or ["-"]]
        ok = True
elif me:
    filters["employee"] = me[0].name
    ok = True

def hhmm(v):
    if not v:
        return None
    p = str(v).split(":")
    return ("0" + p[0])[-2:] + ":" + p[1]


result = []
if ok:
    rows = frappe.get_all(
        "Attendance Request",
        filters=filters,
        fields=[
            "name", "employee", "employee_name", "from_date", "explanation", "docstatus",
            "custom_requested_check_in", "custom_requested_check_out", "custom_rejected",
        ],
        order_by="creation desc",
        limit_page_length=50,
    )
    for q in rows:
        status = "pending"
        if q.custom_rejected or q.docstatus == 2:
            status = "rejected"
        elif q.docstatus == 1:
            status = "approved"
        item = {
            "name": q.name,
            "date": str(q.from_date),
            "check_in": hhmm(q.custom_requested_check_in),
            "check_out": hhmm(q.custom_requested_check_out),
            "reason": q.explanation,
            "status": status,
        }
        if scope == "team":
            item["employee"] = q.employee
            item["employee_name"] = q.employee_name
        result.append(item)
frappe.response["message"] = result
