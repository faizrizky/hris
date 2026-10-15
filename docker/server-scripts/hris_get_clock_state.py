# Server Script (type: API, method: hris_get_clock_state, allow_guest: 0)
# Status clock in/out pemanggil berdasarkan Employee Checkin HARI INI (zona sistem Asia/Jakarta).
# Hasil: {"clocked_in","last_check_in","last_check_out","timezone" (IANA),"timezone_label" (WIB/WITA/WIT/GMT+n),"work_location",
#   "shift_name","shift_start","shift_end" ("HH:MM", dari Shift Assignment aktif hari ini atau shift bawaan karyawan)}
# Panggil: GET /api/method/hris_get_clock_state
state = {"shift_name": None, "shift_start": None, "shift_end": None, "clocked_in": False, "last_check_in": None, "last_check_out": None, "timezone": None, "timezone_label": None, "work_location": None}
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
        fields=["custom_timezone", "custom_destination"],
        order_by="custom_from_date desc",
        limit_page_length=1,
    )
    work_location = None
    if trips:
        work_location = trips[0].custom_destination
        if trips[0].custom_timezone:
            tz = trips[0].custom_timezone
    offset = str(frappe.utils.get_datetime_in_timezone(tz))[-6:]
    tz_names = {"Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT"}
    tz_label = tz_names.get(tz)
    if not tz_label:
        tz_label = "GMT" + offset[0] + str(int(offset[1:3]))
        if offset[4:6] != "00":
            tz_label = tz_label + ":" + offset[4:6]
    state["timezone"] = tz
    state["timezone_label"] = tz_label
    state["work_location"] = work_location
    local_now = str(frappe.utils.get_datetime_in_timezone(tz))[:19]
    today = local_now[:10]

    # --- shift kerja hari ini: Shift Assignment aktif (tanpa/dengan tanggal akhir), jika tidak ada shift bawaan ---
    shift_type = None
    sa = frappe.get_all("Shift Assignment", filters={"employee": me[0].name, "docstatus": 1, "status": "Active",
                                                     "start_date": ["<=", today], "end_date": [">=", today]},
                        fields=["shift_type"], order_by="start_date desc", limit_page_length=1)
    if not sa:
        sa = frappe.get_all("Shift Assignment", filters={"employee": me[0].name, "docstatus": 1, "status": "Active",
                                                         "start_date": ["<=", today], "end_date": ["is", "not set"]},
                            fields=["shift_type"], order_by="start_date desc", limit_page_length=1)
    if sa:
        shift_type = sa[0].shift_type
    if not shift_type:
        shift_type = frappe.db.get_value("Employee", me[0].name, "default_shift")
    if shift_type:
        st = frappe.db.get_value("Shift Type", shift_type, ["start_time", "end_time"], as_dict=True)
        if st and st.start_time is not None and st.end_time is not None:
            s0 = int(st.start_time.total_seconds())
            s1 = int(st.end_time.total_seconds())
            state["shift_name"] = shift_type
            state["shift_start"] = str(s0 // 3600).zfill(2) + ":" + str((s0 % 3600) // 60).zfill(2)
            state["shift_end"] = str(s1 // 3600).zfill(2) + ":" + str((s1 % 3600) // 60).zfill(2)

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
