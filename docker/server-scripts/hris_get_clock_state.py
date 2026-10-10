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
    today = frappe.utils.nowdate()
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
