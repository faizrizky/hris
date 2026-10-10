# Server Script (type: API, method: hris_get_clock_state, allow_guest: 0)
# Status clock in/out pemanggil berdasarkan Employee Checkin HARI INI (zona sistem Asia/Jakarta).
# Hasil: {"clocked_in": bool, "last_check_in": "HH:MM"|null, "last_check_out": "HH:MM"|null}
# Panggil: GET /api/method/hris_get_clock_state
state = {"clocked_in": False, "last_check_in": None, "last_check_out": None}
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)
if me:
    # --- zona waktu kerja aktif: custom_timezone Travel Request approved yang mencakup hari ini ---
    tz = frappe.utils.get_system_timezone()
    sys_today = frappe.utils.nowdate()
    trips = frappe.get_all(
        "Travel Request",
        filters={
            "employee": me[0].name,
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

    logs = frappe.get_all(
        "Employee Checkin",
        filters={
            "employee": me[0].name,
            "time": ["between", [today + " 00:00:00", today + " 23:59:59"]],
        },
        fields=["log_type", "time"],
        order_by="time asc",
        limit_page_length=500,
    )
    for lg in logs:
        hhmm = str(lg.time)[11:16]
        if lg.log_type == "IN":
            state["last_check_in"] = hhmm
        elif lg.log_type == "OUT":
            state["last_check_out"] = hhmm
    if logs:
        state["clocked_in"] = logs[len(logs) - 1].log_type == "IN"
frappe.response["message"] = state
