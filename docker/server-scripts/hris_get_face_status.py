# Server Script (type: API, method: hris_get_face_status, allow_guest: 0)
# Status pendaftaran wajah pemanggil + syarat (KTP terverifikasi dan foto profil).
# Hasil: {"state": "none|pending|active|needs_reenroll|rejected", "grace_until", "note", "ktp_url", "profile_url",
#   "min_ktp","min_profile","min_checkin","require_enrollment"}
# @include: _lib/face_lib.py
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name", "image"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
emp = me[0].name
state = "none"
grace = None
note = None
act = fl_active(emp)
pend = frappe.get_all("Face Enrollment", filters={"employee": emp, "status": "Pending"}, fields=["name"], limit_page_length=1)
last = frappe.get_all("Face Enrollment", filters={"employee": emp}, fields=["name", "status", "hr_note"],
                      order_by="creation desc", limit_page_length=1)
if pend:
    state = "pending"
elif act:
    state = "needs_reenroll" if act.needs_reenroll else "active"
    grace = str(act.grace_until) if act.grace_until else None
elif last and last[0].status == "Rejected":
    state = "rejected"
    note = last[0].hr_note
ktp = fl_ktp(emp)
frappe.response["message"] = {
    "state": state, "grace_until": grace, "note": note,
    "ktp_url": ktp.file if ktp else None, "profile_url": me[0].image or None,
    "min_ktp": fl_setting("min_ktp", 30), "min_profile": fl_setting("min_profile", 36),
    "min_checkin": fl_setting("min_checkin", 36), "require_enrollment": fl_setting("require_enrollment", 0)}
