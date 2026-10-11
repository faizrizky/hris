# Server Script (type: API, method: hris_submit_overtime, allow_guest: 0)
# Ajukan lembur (doctype kustom Overtime Request). POST: date (YYYY-MM-DD), end_time (HH:MM), note.
# Mulai tetap 17:00 hari kerja / 08:00 hari libur (Holiday List karyawan atau hari Minggu).
# Maks 4 jam hari kerja / 8 jam hari libur; tanggal tidak boleh di masa depan atau lebih dari 30 hari lalu.
# Hasil: {"name","date","start_minute","end_minute","hours","note","status":"pending"}
fd = frappe.form_dict
date = fd.get("date")
end_time = (fd.get("end_time") or "").strip()
note = (fd.get("note") or "").strip()
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name", "reports_to", "employee_name", "holiday_list"],
    limit_page_length=1,
)
if not me:
    frappe.throw("This account is not linked to an active employee")
if not date or len(end_time) != 5 or end_time[2] != ":" or not (end_time[:2].isdigit() and end_time[3:].isdigit()):
    frappe.throw("date (YYYY-MM-DD) and end_time (HH:MM) are required")
if int(end_time[:2]) > 23 or int(end_time[3:]) > 59:
    frappe.throw("Invalid end_time")
if not note:
    frappe.throw("Work description is required")
today = frappe.utils.nowdate()
if frappe.utils.getdate(date) > frappe.utils.getdate(today):
    frappe.throw("Overtime date cannot be in the future")
if frappe.utils.date_diff(today, date) > 30:
    frappe.throw("Overtime can only be submitted up to 30 days back")

is_holiday = frappe.utils.getdate(date).weekday() == 6
if me[0].holiday_list and frappe.db.count("Holiday", {"parent": me[0].holiday_list, "holiday_date": date}) > 0:
    is_holiday = True
start_minute = 8 * 60 if is_holiday else 17 * 60
max_hours = 8 if is_holiday else 4
end_minute = int(end_time[:2]) * 60 + int(end_time[3:])
if end_minute <= start_minute:
    frappe.throw("End time must be after the start time")
hours = round((end_minute - start_minute) / 60.0, 2)
if hours > max_hours:
    frappe.throw("Overtime cannot exceed " + str(max_hours) + " hours on this day")
if frappe.db.exists("Overtime Request", {"employee": me[0].name, "date": date, "status": ["!=", "rejected"]}):
    frappe.throw("An overtime request already exists for this date")

def hhmm(m):
    return ("0" + str(m // 60))[-2:] + ":" + ("0" + str(m % 60))[-2:]

doc = frappe.get_doc(
    {
        "doctype": "Overtime Request",
        "employee": me[0].name,
        "date": date,
        "is_holiday": 1 if is_holiday else 0,
        "start_time": hhmm(start_minute) + ":00",
        "end_time": end_time + ":00",
        "hours": hours,
        "note": note,
        "status": "pending",
    }
)
doc.insert(ignore_permissions=True)
boss_user = frappe.db.get_value("Employee", me[0].reports_to, "user_id") if me[0].reports_to else None
if boss_user:
    boss = boss_user
    if boss:
        frappe.get_doc(
            {
                "doctype": "Notification Log",
                "type": "Alert",
                "for_user": boss,
                "subject": "Overtime request from " + str(me[0].employee_name) + " is waiting for your approval",
                "email_content": date + ": " + str(hours) + " hours",
                "document_type": "Overtime Request",
                "document_name": doc.name,
            }
        ).insert(ignore_permissions=True)
if boss_user:
    share = frappe.get_doc({"doctype": "DocShare", "user": boss_user, "share_doctype": "Overtime Request",
                            "share_name": doc.name, "read": 1})
    share.flags.ignore_share_permission = True
    share.insert(ignore_permissions=True)
# Bukti: POST /api/method/upload_file (multipart: file, is_private=1, doctype="Overtime Request",
#   docname=<name>, fieldname="proof") dengan sesi pemilik; atasan diberi akses baca lewat DocShare.
frappe.response["message"] = {
    "name": doc.name,
    "date": date,
    "start_minute": start_minute,
    "end_minute": end_minute,
    "hours": hours,
    "note": note,
    "status": "pending",
}
