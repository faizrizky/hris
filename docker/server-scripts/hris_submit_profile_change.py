# Server Script (type: API, method: hris_submit_profile_change, allow_guest: 0)
# Ajukan perubahan data pribadi. POST: phone, personal_email, address, marital_status, emergency_contacts, family, reason (wajib).
# Format dan validasi sama dengan hris_update_my_profile. Bila sudah ada request Pending, request itu diperbarui.
# Tidak ada perbedaan dengan data saat ini -> 417 "No changes to submit". HR diberi notifikasi.
user = frappe.session.user
me = frappe.get_all("Employee", filters={"user_id": user, "status": "Active"},
                    fields=["name", "employee_name"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
target_emp = me[0].name
# @include: _lib/profile_input.py
# @include: _lib/profile_current.py
reason = (fd.get("reason") or "").strip()
if not reason:
    frappe.throw("A reason is required")
if len(reason) > 500:
    frappe.throw("Reason is too long (max 500 characters)")

existing = frappe.get_all("Profile Change Request", filters={"employee": target_emp, "status": "Pending"},
                          fields=["name", "proposed"], order_by="creation desc", limit_page_length=1)
proposed = json.loads(existing[0].proposed) if existing and existing[0].proposed else {}
for api_key, col in (("phone", "cell_number"), ("personal_email", "personal_email"), ("address", "current_address"),
                     ("marital_status", "marital_status")):
    if col in p_fields:
        proposed[api_key] = p_fields[col] or ""
if ec_rows is not None:
    proposed["emergency_contacts"] = ec_rows
if fam_rows is not None:
    proposed["family"] = fam_rows

def line_ec(r):
    return str(r["contact_name"]) + " · " + str(r["relation"] or "-") + " · " + str(r["phone"])

def line_fam(r):
    return (str(r["member_name"]) + " · " + str(r["relation"]) + " · " + str(r["date_of_birth"] or "-") + " · "
            + ("Dependent" if r["is_dependent"] else "Not dependent"))

labels = {"phone": "Phone", "personal_email": "Personal Email", "address": "Address", "marital_status": "Marital Status",
          "emergency_contacts": "Emergency Contacts", "family": "Family Members"}
changes = []
kept = {}
for k in ("phone", "personal_email", "address", "marital_status", "emergency_contacts", "family"):
    if k not in proposed:
        continue
    if json.dumps(proposed[k], sort_keys=True) == json.dumps(cur[k], sort_keys=True):
        continue
    kept[k] = proposed[k]
    if k == "emergency_contacts":
        changes.append({"field": k, "label": labels[k], "current": "\n".join([line_ec(r) for r in cur[k]]),
                        "proposed": "\n".join([line_ec(r) for r in proposed[k]])})
    elif k == "family":
        changes.append({"field": k, "label": labels[k], "current": "\n".join([line_fam(r) for r in cur[k]]),
                        "proposed": "\n".join([line_fam(r) for r in proposed[k]])})
    else:
        changes.append({"field": k, "label": labels[k], "current": cur[k], "proposed": proposed[k]})
if not changes:
    frappe.throw("No changes to submit")

vals = {"reason": reason, "proposed": json.dumps(kept), "changes": json.dumps(changes), "status": "Pending"}
if existing:
    frappe.db.set_value("Profile Change Request", existing[0].name, vals)
    pcr_name = existing[0].name
else:
    vals["doctype"] = "Profile Change Request"
    vals["employee"] = target_emp
    pcr = frappe.get_doc(vals)
    pcr.insert(ignore_permissions=True)
    pcr_name = pcr.name
summary = ", ".join([c["label"] for c in changes])
sent = []
for u in frappe.get_all("Has Role", filters={"role": ["in", ["HR Manager", "HR User"]], "parenttype": "User"},
                        pluck="parent", limit_page_length=100):
    if u != "Administrator" and u != user and u not in sent:
        sent.append(u)
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": u,
                        "subject": str(me[0].employee_name) + " requested a profile change (" + summary + ")",
                        "email_content": reason, "document_type": "Profile Change Request",
                        "document_name": pcr_name}).insert(ignore_permissions=True)
row = frappe.get_all("Profile Change Request", filters={"name": pcr_name},
                     fields=["name", "status", "reason", "hr_note", "creation", "decided_on"], limit_page_length=1)[0]
frappe.response["message"] = {"name": row.name, "status": row.status, "reason": row.reason, "hr_note": row.hr_note,
                              "changes": changes, "created_on": str(row.creation)[:19].replace(" ", "T"),
                              "decided_on": None, "updated": 1 if existing else 0}
