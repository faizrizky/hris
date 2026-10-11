# Server Script (type: API, method: hris_decide_profile_change, allow_guest: 0)
# POST: name, decision (approve | reject), note (wajib bila reject). Hanya HR User / HR Manager, hanya status Pending,
# dan HR TIDAK boleh memutuskan request miliknya sendiri (403). approve -> nilai usulan diterapkan ke Employee pemohon.
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
if not is_hr:
    frappe.throw("Only HR can decide profile changes", frappe.PermissionError)
name = frappe.form_dict.get("name")
decision = frappe.form_dict.get("decision")
note = (frappe.form_dict.get("note") or "").strip()
if decision != "approve" and decision != "reject":
    frappe.throw("decision must be approve or reject")
if not name or not frappe.db.exists("Profile Change Request", name):
    frappe.throw("Profile change request not found")
req = frappe.get_doc("Profile Change Request", name)
if req.status != "Pending":
    frappe.throw("This request has already been decided")
requester_user = frappe.db.get_value("Employee", req.employee, "user_id")
if requester_user == user and user != "Administrator":
    frappe.throw("You cannot decide your own request. Another HR member must do it.", frappe.PermissionError)
if decision == "reject" and not note:
    frappe.throw("A note is required when rejecting a request")
if decision == "approve":
    prop = json.loads(req.proposed) if req.proposed else {}
    target_emp = req.employee
    p_fields = {}
    if "phone" in prop:
        p_fields["cell_number"] = prop["phone"] or None
    if "personal_email" in prop:
        p_fields["personal_email"] = prop["personal_email"] or None
    if "address" in prop:
        p_fields["current_address"] = prop["address"] or None
    if "marital_status" in prop:
        p_fields["marital_status"] = prop["marital_status"] or None
    ec_rows = prop.get("emergency_contacts")
    fam_rows = prop.get("family")
    # @include: _lib/profile_apply.py
word = "approved" if decision == "approve" else "rejected"
frappe.db.set_value("Profile Change Request", name,
                    {"status": "Approved" if decision == "approve" else "Rejected", "hr_note": note or None,
                     "decided_by": user, "decided_on": frappe.utils.now_datetime()})
if requester_user:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": requester_user,
                    "subject": "Your profile change request was " + word,
                    "email_content": note or "Your profile data has been updated.",
                    "document_type": "Profile Change Request", "document_name": name}).insert(ignore_permissions=True)
frappe.response["message"] = {"name": name, "status": "Approved" if decision == "approve" else "Rejected",
                              "hr_note": note or None, "decided_by": user}
