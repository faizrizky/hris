# Server Script (type: API, method: hris_submit_face_enrollment, allow_guest: 0)
# Ajukan pendaftaran wajah. POST: embeddings (JSON: daftar 1-12 vektor 128 angka dari lingkaran pendaftaran),
# ktp_embedding, profile_embedding (JSON 128 angka). Syarat: KTP terverifikasi dan foto profil ada.
# Server menghitung kemiripan (wajah vs KTP, wajah vs foto profil, foto profil vs KTP). Selfie diunggah terpisah ke
# field "selfie" dokumen yang dikembalikan. Hasil: {"name","status":"Pending","score_ktp","score_profile"}
# @include: _lib/face_lib.py
fd = frappe.form_dict
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name", "employee_name", "image"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
emp = me[0].name
ktp = fl_ktp(emp)
if not ktp:
    frappe.throw("Upload your ID card (KTP) in Profile and wait for HR verification before registering your face")
if not me[0].image:
    frappe.throw("Set a profile photo before registering your face")
raw = json.loads(fd.get("embeddings") or "[]")
vs = [fl_parse(x) for x in raw]
vs = [v for v in vs if v]
if len(vs) < 1 or len(vs) > 12:
    frappe.throw("Face scan is incomplete")
ke = fl_parse(fd.get("ktp_embedding"))
pe = fl_parse(fd.get("profile_embedding"))
if not ke:
    frappe.throw("No face could be read from the ID card photo")
if not pe:
    frappe.throw("No face could be read from the profile photo")
cen = fl_centroid(vs)
for o in frappe.get_all("Face Enrollment", filters={"employee": emp, "status": "Pending"}, fields=["name"], limit_page_length=20):
    frappe.db.set_value("Face Enrollment", o.name, "status", "Superseded")
doc = frappe.get_doc({"doctype": "Face Enrollment", "employee": emp, "status": "Pending", "ktp_document": ktp.name,
                      "face_embeddings": json.dumps(vs), "ktp_embedding": json.dumps(ke), "profile_embedding": json.dumps(pe),
                      "score_ktp": fl_pct(cen, ke), "score_profile": fl_pct(cen, pe), "score_profile_ktp": fl_pct(pe, ke)})
doc.insert(ignore_permissions=True)
for u in fl_hr_users():
    fl_notify(u, "Face registration from " + me[0].employee_name + " needs review",
              "Match with ID card " + str(doc.score_ktp) + "%, with profile photo " + str(doc.score_profile) + "%.",
              "Face Enrollment", doc.name)
frappe.response["message"] = {"name": doc.name, "status": "Pending", "score_ktp": doc.score_ktp,
                              "score_profile": doc.score_profile}
