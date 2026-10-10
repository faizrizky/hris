# Server Script (type: API, method: hris_decide_attendance_correction, allow_guest: 0)
# Putuskan koreksi absensi. Hanya atasan langsung pemohon (Employee.reports_to) atau HR User/HR Manager.
# POST body: name (Attendance Request), decision ("approve" | "reject")
# approve: Attendance Request di-submit (hrms membuat/ubah Attendance), lalu in_time/out_time
#          Attendance diisi dari jam koreksi. reject: ditandai custom_rejected (tetap draft).
# Hasil: {"name","status":"approved|rejected"}
user = frappe.session.user
fd = frappe.form_dict
name = fd.get("name")
decision = fd.get("decision")
if decision != "approve" and decision != "reject":
    frappe.throw("decision harus approve atau reject")
if not name or not frappe.db.exists("Attendance Request", name):
    frappe.throw("Koreksi tidak ditemukan")
req = frappe.get_doc("Attendance Request", name)
if req.docstatus != 0 or req.custom_rejected:
    frappe.throw("Koreksi ini sudah diputuskan")

is_hr = user == "Administrator" or len(
    frappe.get_all(
        "Has Role",
        filters={"parent": user, "parenttype": "User", "role": ["in", ["HR User", "HR Manager"]]},
        limit_page_length=1,
    )
) > 0
allowed = is_hr
if not allowed:
    boss = frappe.get_all("Employee", filters={"name": req.employee}, fields=["reports_to"], limit_page_length=1)
    if boss and boss[0].reports_to:
        boss_user = frappe.get_all(
            "Employee", filters={"name": boss[0].reports_to}, fields=["user_id"], limit_page_length=1
        )
        allowed = bool(boss_user and boss_user[0].user_id == user)
mine = frappe.get_all("Employee", filters={"user_id": user}, fields=["name"], limit_page_length=1)
if mine and mine[0].name == req.employee and not (user == "Administrator"):
    allowed = False
if not allowed:
    frappe.throw("Anda bukan atasan langsung pemohon", frappe.PermissionError)

if decision == "reject":
    frappe.db.set_value("Attendance Request", name, "custom_rejected", 1)
    frappe.response["message"] = {"name": name, "status": "rejected"}
else:
    req.flags.ignore_permissions = True
    req.submit()
    atts = frappe.get_all(
        "Attendance",
        filters={"attendance_request": name, "docstatus": 1},
        fields=["name", "attendance_date"],
        limit_page_length=10,
    )
    cin = str(req.custom_requested_check_in)
    cout = str(req.custom_requested_check_out)
    for a in atts:
        d = str(a.attendance_date)
        t_in = d + " " + cin
        t_out = d + " " + cout
        hours = round(frappe.utils.time_diff_in_seconds(t_out, t_in) / 3600.0, 2)
        frappe.db.set_value(
            "Attendance", a.name, {"in_time": t_in, "out_time": t_out, "working_hours": hours}
        )
    frappe.response["message"] = {"name": name, "status": "approved"}
