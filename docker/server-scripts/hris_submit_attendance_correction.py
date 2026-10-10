# Server Script (type: API, method: hris_submit_attendance_correction, allow_guest: 0)
# Ajukan koreksi absensi (Attendance Request draft) untuk Employee pemanggil.
# POST body: date "YYYY-MM-DD", check_in "HH:MM", check_out "HH:MM", reason (teks)
# Hasil: {"name","date","check_in","check_out","reason","status":"pending"}
fd = frappe.form_dict
date = fd.get("date")
check_in = fd.get("check_in")
check_out = fd.get("check_out")
reason = fd.get("reason")


def valid_hhmm(v):
    if not v or len(v) != 5 or v[2] != ":":
        return False
    hh = v[:2]
    mm = v[3:]
    if not (hh.isdigit() and mm.isdigit()):
        return False
    return int(hh) < 24 and int(mm) < 60


me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name", "company"],
    limit_page_length=1,
)
if not me:
    frappe.throw("This account is not linked to an active employee")
if not date or not valid_hhmm(check_in) or not valid_hhmm(check_out):
    frappe.throw("date (YYYY-MM-DD), check_in and check_out (HH:MM) are required")
if not reason:
    frappe.throw("Reason is required")
today = frappe.utils.nowdate()
if frappe.utils.getdate(date) > frappe.utils.getdate(today):
    frappe.throw("Correction date cannot be in the future")
if frappe.utils.date_diff(today, date) > 30:
    frappe.throw("Corrections can only be made up to 30 days back")
if check_out <= check_in:
    frappe.throw("Check-out must be after check-in")

doc = frappe.get_doc(
    {
        "doctype": "Attendance Request",
        "employee": me[0].name,
        "company": me[0].company,
        "from_date": date,
        "to_date": date,
        "reason": "On Duty",
        "explanation": reason,
        "custom_requested_check_in": check_in + ":00",
        "custom_requested_check_out": check_out + ":00",
    }
)
doc.insert(ignore_permissions=True)
frappe.response["message"] = {
    "name": doc.name,
    "date": date,
    "check_in": check_in,
    "check_out": check_out,
    "reason": reason,
    "status": "pending",
}
