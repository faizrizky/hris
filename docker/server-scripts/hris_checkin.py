# Server Script (type: API, method: hris_checkin, allow_guest: 0)
# Clock in/out dengan waktu ditentukan SERVER (klien tidak mengirim jam).
# POST body: log_type = IN | OUT.
# Zona waktu = custom_timezone Travel Request yang approved dan mencakup hari ini; selain itu zona sistem.
# time disimpan sebagai jam dinding lokal zona itu (naive), zona yang dipakai disimpan di custom_timezone.
# Hasil: {"name","log_type","time":"YYYY-MM-DD HH:MM:SS","timezone"}
log_type = (frappe.form_dict.get("log_type") or "").upper()
if log_type != "IN" and log_type != "OUT":
    frappe.throw("log_type must be IN or OUT")
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)
if not me:
    frappe.throw("This account is not linked to an active employee")
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
offset = str(frappe.utils.get_datetime_in_timezone(tz))[-6:]
tz_names = {"Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT"}
tz_label = tz_names.get(tz)
if not tz_label:
    tz_label = "GMT" + offset[0] + str(int(offset[1:3]))
    if offset[4:6] != "00":
        tz_label = tz_label + ":" + offset[4:6]
doc = frappe.get_doc(
    {
        "doctype": "Employee Checkin",
        "employee": me[0].name,
        "log_type": log_type,
        "time": local_now,
        "device_id": "hris-mobile",
        "custom_timezone": tz,
    }
)
doc.insert(ignore_permissions=True)
frappe.response["message"] = {"name": doc.name, "log_type": log_type, "time": local_now, "timezone": tz, "timezone_label": tz_label}
