# Server Script (type: API, method: hris_get_staff_attendance_history, allow_guest: 0)
# Riwayat absensi KARYAWAN LAIN (?employee=HR-EMP-xxxxx&limit=30, maks 90). HR: semua; atasan: bawahan langsung;
# karyawan biasa: hanya dirinya. Bentuk item sama dengan hris_get_attendance_history: Attendance (docstatus 1),
# ditambah hari ini dari Employee Checkin bila belum ada Attendance hari ini.
# Hasil: [{"date","status","check_in","check_out","working_hours","late_entry"}]
# Panggil: GET /api/method/hris_get_staff_attendance_history?employee=HR-EMP-00001&limit=30
result = []
target = frappe.form_dict.get("employee")
limit = int(frappe.form_dict.get("limit") or 30)
if limit > 90:
    limit = 90
user = frappe.session.user
caller = frappe.get_all("Employee", filters={"user_id": user, "status": "Active"}, fields=["name"], limit_page_length=1)
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User", "role": ["in", ["HR User", "HR Manager"]]},
                   limit_page_length=1)
) > 0
if not target or not frappe.db.exists("Employee", target):
    frappe.throw("employee is required and must exist")
allowed = is_hr
if not allowed and caller:
    if caller[0].name == target:
        allowed = True
    elif frappe.db.get_value("Employee", target, "reports_to") == caller[0].name:
        allowed = True
if not allowed:
    frappe.throw("You are not allowed to view this employee's attendance", frappe.PermissionError)
emp_id = target
if emp_id:
    # --- zona waktu kerja aktif: custom_timezone Travel Request approved yang mencakup hari ini ---
    tz = frappe.utils.get_system_timezone()
    sys_today = frappe.utils.nowdate()
    trips = frappe.get_all(
        "Travel Request",
        filters={
            "employee": emp_id,
            "docstatus": 1,
            "custom_rejected": 0,
            "custom_from_date": ["<=", sys_today],
            "custom_to_date": [">=", sys_today],
        },
        fields=["custom_timezone"],
        order_by="custom_from_date desc",
        limit_page_length=1,
    )
    if trips and trips[0].custom_timezone:
        tz = trips[0].custom_timezone
    local_now = str(frappe.utils.get_datetime_in_timezone(tz))[:19]
    today = local_now[:10]

    since = frappe.utils.add_days(today, -limit)
    rows = frappe.get_all(
        "Attendance",
        filters={
            "employee": emp_id,
            "docstatus": 1,
            "attendance_date": ["between", [since, today]],
        },
        fields=["attendance_date", "status", "in_time", "out_time", "working_hours", "late_entry"],
        order_by="attendance_date desc",
        limit_page_length=limit + 1,
    )
    have_today = False
    for a in rows:
        if str(a.attendance_date) == today:
            have_today = True
        result.append(
            {
                "date": str(a.attendance_date),
                "status": a.status,
                "check_in": str(a.in_time)[11:16] if a.in_time else None,
                "check_out": str(a.out_time)[11:16] if a.out_time else None,
                "working_hours": a.working_hours if a.in_time else None,
                "late_entry": 1 if a.late_entry else 0,
            }
        )
    if not have_today:
        logs = frappe.get_all(
            "Employee Checkin",
            filters={
                "employee": emp_id,
                "time": ["between", [today + " 00:00:00", today + " 23:59:59"]],
            },
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
            hours = None
            if last_out:
                hours = round(frappe.utils.time_diff_in_seconds(last_out.time, first_in.time) / 3600.0, 2)
            late = 0
            if first_in.shift_start:
                if frappe.utils.time_diff_in_seconds(first_in.time, first_in.shift_start) > 600:
                    late = 1
            result.insert(
                0,
                {
                    "date": today,
                    "status": "Present",
                    "check_in": str(first_in.time)[11:16],
                    "check_out": str(last_out.time)[11:16] if last_out else None,
                    "working_hours": hours,
                    "late_entry": late,
                },
            )
frappe.response["message"] = result
