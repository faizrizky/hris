# Server Script (type: API, method: hris_get_face_enrollments_for_review, allow_guest: 0)
# HR: daftar pendaftaran wajah berstatus Pending beserta foto dan skor, untuk ditinjau di aplikasi.
# Keputusan lewat hris_decide_face_enrollment. Hasil:
# [{"name","employee","employee_name","created","score_ktp","score_profile","score_profile_ktp","spoof_mean",
#   "selfie_url","profile_url","ktp_url","min_ktp","min_profile"}]
# @include: _lib/face_lib.py
user = frappe.session.user
if user != "Administrator" and not (user in fl_hr_users()):
    frappe.throw("Only HR can review face registrations", frappe.PermissionError)
rows = frappe.get_all("Face Enrollment", filters={"status": "Pending"},
                      fields=["name", "employee", "employee_name", "creation", "score_ktp", "score_profile",
                              "score_profile_ktp", "selfie", "ktp_document", "custom_spoof_mean"],
                      order_by="creation asc", limit_page_length=100)
min_ktp = fl_setting("min_ktp", 34)
min_prof = fl_setting("min_profile", 36)
out = []
for r in rows:
    ktp_url = None
    if r.ktp_document:
        ktp_url = frappe.db.get_value("Employee Document", r.ktp_document, "file")
        if not ktp_url:
            f = frappe.get_all("File", filters={"attached_to_doctype": "Employee Document",
                                                "attached_to_name": r.ktp_document},
                               fields=["file_url"], order_by="creation desc", limit_page_length=1)
            ktp_url = f[0].file_url if f else None
    out.append({"name": r.name, "employee": r.employee, "employee_name": r.employee_name,
                "created": str(r.creation)[:19], "score_ktp": r.score_ktp, "score_profile": r.score_profile,
                "score_profile_ktp": r.score_profile_ktp, "spoof_mean": r.custom_spoof_mean,
                "selfie_url": r.selfie, "profile_url": frappe.db.get_value("Employee", r.employee, "image"),
                "ktp_url": ktp_url, "min_ktp": min_ktp, "min_profile": min_prof})
frappe.response["message"] = out
