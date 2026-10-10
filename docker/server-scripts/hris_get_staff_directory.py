# Server Script (type: API, method: hris_get_staff_directory, allow_guest: 0)
# Direktori karyawan. HR User / HR Manager: semua Employee Active. Selain itu: hanya
# bawahan langsung (reports_to = Employee pemanggil), tanpa dirinya sendiri.
# Memakai frappe.get_all (melewati User Permission); hanya field yang tercantum yang dikembalikan.
# Panggil: GET /api/method/hris_get_staff_directory
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all(
        "Has Role",
        filters={
            "parent": user,
            "parenttype": "User",
            "role": ["in", ["HR User", "HR Manager"]],
        },
        limit_page_length=1,
    )
) > 0

total_active = frappe.db.count("Employee", {"status": "Active"})
me = frappe.get_all(
    "Employee",
    filters={"user_id": user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)

filters = {"status": "Active"}
rows = []
if is_hr:
    rows = frappe.get_all(
        "Employee",
        filters=filters,
        fields=[
            "name", "employee_name", "designation", "department", "employee_number",
            "employment_type", "contract_end_date", "date_of_joining", "reports_to",
            "company_email", "cell_number",
        ],
        order_by="employee_name asc",
        limit_page_length=1000,
    )
elif me:
    filters["reports_to"] = me[0].name
    rows = frappe.get_all(
        "Employee",
        filters=filters,
        fields=[
            "name", "employee_name", "designation", "department", "employee_number",
            "employment_type", "contract_end_date", "date_of_joining", "reports_to",
            "company_email", "cell_number",
        ],
        order_by="employee_name asc",
        limit_page_length=1000,
    )

today = frappe.utils.nowdate()
items = []
summary = {"attend": 0, "late": 0, "leave": 0, "belum": 0}
for r in rows:
    if (not is_hr) and me and r.name == me[0].name:
        continue
    manager = None
    if r.reports_to:
        manager = frappe.db.get_value("Employee", r.reports_to, "employee_name")
    shift = None
    sa = frappe.get_all(
        "Shift Assignment",
        filters={
            "employee": r.name,
            "docstatus": 1,
            "status": "Active",
            "start_date": ["<=", today],
        },
        or_filters=[["end_date", ">=", today], ["end_date", "is", "not set"]],
        fields=["shift_type"],
        order_by="start_date desc",
        limit_page_length=1,
    )
    if sa:
        shift = sa[0].shift_type
    leave_left = None
    alloc = frappe.get_all(
        "Leave Allocation",
        filters={
            "employee": r.name,
            "leave_type": "Annual Leave",
            "docstatus": 1,
            "from_date": ["<=", today],
            "to_date": [">=", today],
        },
        fields=["total_leaves_allocated", "from_date", "to_date"],
        limit_page_length=50,
    )
    if alloc:
        total = 0
        for a in alloc:
            total = total + a.total_leaves_allocated
        used = frappe.get_all(
            "Leave Application",
            filters={
                "employee": r.name,
                "leave_type": "Annual Leave",
                "docstatus": 1,
                "status": "Approved",
                "from_date": [">=", alloc[0].from_date],
                "to_date": ["<=", alloc[0].to_date],
            },
            fields=["total_leave_days"],
            limit_page_length=500,
        )
        taken = 0
        for u in used:
            taken = taken + u.total_leave_days
        leave_left = total - taken
    # --- status kehadiran hari ini ---
    today_info = {"state": None, "check_in": None, "check_out": None, "label": "Not Checked In"}
    att = frappe.get_all(
        "Attendance",
        filters={"employee": r.name, "docstatus": 1, "attendance_date": today},
        fields=["status", "late_entry", "in_time", "out_time"],
        limit_page_length=1,
    )
    if att:
        a0 = att[0]
        today_info["check_in"] = str(a0.in_time)[11:16] if a0.in_time else None
        today_info["check_out"] = str(a0.out_time)[11:16] if a0.out_time else None
        if a0.status == "Present" or a0.status == "Work From Home":
            if a0.late_entry:
                today_info["state"] = "late"
                today_info["label"] = "Late"
            else:
                today_info["state"] = "attend"
                today_info["label"] = "Present"
        elif a0.status == "Absent":
            today_info["state"] = "leave"
            today_info["label"] = "Absent"
        else:
            today_info["state"] = "leave"
            today_info["label"] = "On Leave"
    else:
        logs = frappe.get_all(
            "Employee Checkin",
            filters={"employee": r.name, "time": ["between", [today + " 00:00:00", today + " 23:59:59"]]},
            fields=["log_type", "time", "shift_start"],
            order_by="time asc",
            limit_page_length=500,
        )
        first_in = None
        last_out = None
        for lg in logs:
            if lg.log_type == "IN" and first_in is None:
                first_in = lg
            if lg.log_type == "OUT":
                last_out = lg
        if first_in:
            today_info["check_in"] = str(first_in.time)[11:16]
            today_info["check_out"] = str(last_out.time)[11:16] if last_out else None
            if first_in.shift_start and frappe.utils.time_diff_in_seconds(first_in.time, first_in.shift_start) > 600:
                today_info["state"] = "late"
                today_info["label"] = "Late"
            else:
                today_info["state"] = "attend"
                today_info["label"] = "Present"
    summary[today_info["state"] or "belum"] = summary[today_info["state"] or "belum"] + 1

    # --- persentase kehadiran bulan berjalan ---
    month_start = today[:8] + "01"
    month_att = frappe.get_all(
        "Attendance",
        filters={"employee": r.name, "docstatus": 1, "attendance_date": ["between", [month_start, today]]},
        fields=["status"],
        limit_page_length=500,
    )
    attendance_rate = None
    if len(month_att) > 0:
        present_days = 0
        for ma in month_att:
            if ma.status == "Present" or ma.status == "Work From Home":
                present_days = present_days + 1
        attendance_rate = round(present_days * 100.0 / len(month_att), 1)

    items.append(
        {
            "name": r.name,
            "employee_name": r.employee_name,
            "designation": r.designation,
            "department": r.department,
            "employee_number": r.employee_number,
            "employment_type": r.employment_type,
            "contract_end_date": r.contract_end_date,
            "date_of_joining": r.date_of_joining,
            "reports_to_name": manager,
            "shift": shift,
            "company_email": r.company_email,
            "cell_number": r.cell_number,
            "leave_left": leave_left,
            "today": today_info,
            "attendance_rate": attendance_rate,
        }
    )

frappe.response["message"] = {"total_active": total_active, "items": items, "today_summary": summary}
