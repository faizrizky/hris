# Server Script (type: API, method: hris_decide_face_enrollment, allow_guest: 0)
# POST: name, decision (approve | reject), note (wajib bila reject). Hanya HR; bukan pendaftaran milik sendiri.
# approve: pendaftaran Active menjadi Superseded, ini menjadi Active; selfie dihapus. reject: selfie dihapus.
# @include: _lib/face_lib.py
user = frappe.session.user
if user != "Administrator" and not (user in fl_hr_users()):
    frappe.throw("Only HR can decide face registrations", frappe.PermissionError)
fd = frappe.form_dict
name = fd.get("name")
decision = fd.get("decision")
note = (fd.get("note") or "").strip()
if decision != "approve" and decision != "reject":
    frappe.throw("decision must be approve or reject")
if not name or not frappe.db.exists("Face Enrollment", name):
    frappe.throw("Face registration not found")
doc = frappe.get_doc("Face Enrollment", name)
if doc.status != "Pending":
    frappe.throw("This registration has already been decided")
target = frappe.db.get_value("Employee", doc.employee, "user_id")
if target == user and user != "Administrator":
    frappe.throw("You cannot decide your own face registration. Another HR member must do it.", frappe.PermissionError)
if decision == "reject" and not note:
    frappe.throw("A note is required when rejecting")
if decision == "approve":
    for o in frappe.get_all("Face Enrollment", filters={"employee": doc.employee, "status": "Active"}, fields=["name"],
                            limit_page_length=20):
        frappe.db.set_value("Face Enrollment", o.name, "status", "Superseded")
selfie = doc.selfie
frappe.db.set_value("Face Enrollment", name, {"status": "Active" if decision == "approve" else "Rejected",
                                              "hr_note": note or None, "decided_by": user,
                                              "decided_on": frappe.utils.now_datetime(), "needs_reenroll": 0,
                                              "grace_until": None, "selfie": None})
if selfie:
    for f in frappe.get_all("File", filters={"file_url": selfie, "attached_to_name": name}, fields=["name"], limit_page_length=5):
        frappe.delete_doc("File", f.name, ignore_permissions=True, force=True)
word = "approved" if decision == "approve" else "rejected"
fl_notify(target, "Your face registration was " + word,
          note or ("You can now clock in with face verification." if decision == "approve" else "Please register again."),
          "Face Enrollment", name)
frappe.response["message"] = {"name": name, "status": "Active" if decision == "approve" else "Rejected"}
