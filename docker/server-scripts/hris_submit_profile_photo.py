# Server Script (type: API, method: hris_submit_profile_photo, allow_guest: 0)
# Ajukan foto profil baru (Profile Change Request, diputuskan HR). POST: embedding (JSON 128 angka dari foto baru),
# reason, photo_b64 (JPEG base64, wajib bila bukan dry_run), ktp_embedding (opsional), dry_run=1 (hanya hitung kemiripan, tanpa membuat permintaan). Server menghitung kemiripan foto baru dengan wajah terdaftar dan KTP. Foto diunggah terpisah ke field
# "photo" dokumen yang dikembalikan. Hasil: {"name","status":"Pending","score_face","score_ktp","below_min": bool}
# @include: _lib/face_lib.py
fd = frappe.form_dict
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name", "employee_name"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
emp = me[0].name
reason = (fd.get("reason") or "").strip() or "Change profile photo"
pe = fl_parse(fd.get("embedding"))
if not pe:
    frappe.throw("No face could be read from this photo. Use a clear, front-facing photo.")
score_face = None
score_ktp = None
act = fl_active(emp)
if act:
    score_face = fl_pct(fl_centroid([fl_parse(x) for x in json.loads(act.face_embeddings)]), pe)
ktp_emb = fl_parse(fd.get("ktp_embedding"))
if not ktp_emb and act and act.ktp_embedding:
    ktp_emb = fl_parse(act.ktp_embedding)
score_ktp = fl_pct(pe, ktp_emb)
below = score_face is not None and score_face < fl_setting("min_profile", 36)
msg = {"name": None, "status": "Preview", "score_face": score_face, "score_ktp": score_ktp, "below_min": bool(below)}
if not fd.get("dry_run") and not fd.get("photo_b64"):
    frappe.throw("The photo is missing")
if not fd.get("dry_run"):
    for o in frappe.get_all("Profile Change Request", filters={"employee": emp, "status": "Pending"},
                            fields=["name", "proposed"], limit_page_length=20):
        if "photo" in (o.proposed or ""):
            frappe.db.set_value("Profile Change Request", o.name, "status", "Rejected")
            frappe.db.set_value("Profile Change Request", o.name, "hr_note", "Superseded by a newer photo")
    doc = frappe.get_doc({"doctype": "Profile Change Request", "employee": emp, "status": "Pending", "reason": reason,
                          "proposed": json.dumps({"photo": True}),
                          "changes": json.dumps([{"field": "photo", "label": "Profile Photo", "current": "",
                                                  "proposed": "New photo"}]),
                          "photo_embedding": json.dumps(pe),
                          "photo_score_face": score_face, "photo_score_ktp": score_ktp})
    doc.insert(ignore_permissions=True)
    for u in fl_hr_users():
        fl_notify(u, "Profile photo change from " + me[0].employee_name, reason, "Profile Change Request", doc.name)
    fl_attach("Profile Change Request", doc.name, "photo", fd.get("photo_b64"), "profile-photo.jpg")
    msg["name"] = doc.name
    msg["status"] = "Pending"
frappe.response["message"] = msg
