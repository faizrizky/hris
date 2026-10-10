# Server Script (type: API, method: hris_get_attendance_history, allow_guest: 0)
# Riwayat absensi pemanggil, maksimal 31 hari terakhir (terbaru dulu): Attendance (docstatus 1),
# ditambah hari ini dari Employee Checkin bila belum ada Attendance hari ini.
# Hasil: [{"date","status","check_in","check_out","working_hours","late_entry"}]
# Panggil: GET /api/method/hris_get_attendance_history
result = []
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)
if me:
    today = frappe.utils.nowdate()
    since = frappe.utils.add_days(today, -30)
    rows = frappe.get_all(
        "Attendance",
        filters={
            "employee": me[0].name,
            "docstatus": 1,
            "attendance_date": ["between", [since, today]],
        },
        fields=["attendance_date", "status", "in_time", "out_time", "working_hours", "late_entry"],
        order_by="attendance_date desc",
        limit_page_length=31,
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
                "employee": me[0].name,
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
