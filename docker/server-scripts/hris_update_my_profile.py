# Server Script (type: API, method: hris_update_my_profile, allow_guest: 0)
# Ubah bagian profil yang boleh diedit sendiri. POST body (semua opsional, hanya yang dikirim diubah):
#   phone, personal_email, address, em2_name, em2_relation, em2_phone
# Hanya Employee milik pemanggil dan hanya field itu. Hasil: profil terbaru (bentuk hris_get_my_profile).
fd = frappe.form_dict
mapping = {
    "phone": ("cell_number", 20),
    "personal_email": ("personal_email", 140),
    "address": ("current_address", 500),
    "em2_name": ("custom_em2_name", 140),
    "em2_relation": ("custom_em2_relation", 60),
    "em2_phone": ("custom_em2_phone", 20),
}
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)
if not me:
    frappe.throw("This account is not linked to an active employee")
updates = {}
for key in mapping:
    if key in fd:
        val = fd.get(key)
        val = "" if val is None else str(val).strip()
        if len(val) > mapping[key][1]:
            frappe.throw(key + " is too long (max " + str(mapping[key][1]) + " characters)")
        if key == "personal_email" and val:
            at = val.find("@")
            if at < 1 or "." not in val[at:] or " " in val or val.endswith(".") or val.count("@") != 1:
                frappe.throw("Invalid email format")
        if key in ("phone", "em2_phone") and val:
            for ch in val:
                if ch not in "0123456789+-() ":
                    frappe.throw("Invalid phone number format")
        updates[mapping[key][0]] = val if val else None
if updates:
    frappe.db.set_value("Employee", me[0].name, updates)

# emergency_contacts: daftar JSON [{contact_name, relation, phone}] atau teks "nama|relasi|telepon;..."
# Mengganti seluruh isi tabel. Maks 5 baris; nama dan telepon wajib; telepon minimal 8 digit.
if "emergency_contacts" in fd:
    raw = fd.get("emergency_contacts")
    items = []
    if isinstance(raw, list):
        for c in raw:
            items.append([str(c.get("contact_name") or "").strip(), str(c.get("relation") or "").strip(),
                          str(c.get("phone") or "").strip()])
    elif raw:
        for part in str(raw).split(";"):
            if not part.strip():
                continue
            bits = [b.strip() for b in part.split("|")]
            while len(bits) < 3:
                bits.append("")
            items.append(bits[:3])
    if len(items) > 5:
        frappe.throw("At most 5 emergency contacts are allowed")
    allowed_rel = ["Mother", "Father", "Sibling", "Spouse", "Friend", "Other"]
    rows = []
    for it in items:
        if not it[0] or not it[2]:
            frappe.throw("Emergency contact name and phone are required")
        if len(it[0]) > 140:
            frappe.throw("Emergency contact name is too long (max 140 characters)")
        digits = 0
        for ch in it[2]:
            if ch.isdigit():
                digits = digits + 1
            elif ch not in "+-() ":
                frappe.throw("Invalid phone number format")
        if digits < 8:
            frappe.throw("Emergency contact phone must have at least 8 digits")
        rel = it[1] if it[1] in allowed_rel else ("Other" if it[1] else None)
        rows.append({"contact_name": it[0], "relation": rel, "phone": it[2]})
    emp_doc = frappe.get_doc("Employee", me[0].name)
    emp_doc.set("custom_emergency_contacts", rows)
    emp_doc.flags.ignore_permissions = True
    emp_doc.flags.ignore_mandatory = True
    emp_doc.save()
e = frappe.get_all(
    "Employee",
    filters={"name": me[0].name},
    fields=[
        "employee_name", "date_of_birth", "gender", "marital_status", "company_email",
        "personal_email", "cell_number", "current_address", "permanent_address",
        "person_to_be_contacted", "relation", "emergency_phone_number",
        "custom_em2_name", "custom_em2_relation", "custom_em2_phone",
    ],
    limit_page_length=1,
)[0]
frappe.response["message"] = {
    "employee_name": e.employee_name,
    "date_of_birth": str(e.date_of_birth) if e.date_of_birth else None,
    "place_of_birth": None,
    "gender": e.gender,
    "marital_status": e.marital_status,
    "religion": None,
    "company_email": e.company_email,
    "personal_email": e.personal_email,
    "cell_number": e.cell_number,
    "current_address": e.current_address,
    "permanent_address": e.permanent_address,
    "emergency": {"name": e.person_to_be_contacted, "relation": e.relation, "phone": e.emergency_phone_number},
    "em2": {"name": e.custom_em2_name, "relation": e.custom_em2_relation, "phone": e.custom_em2_phone},
    "family": [],
    "emergency_contacts": [
        {"contact_name": c.contact_name, "relation": c.relation, "phone": c.phone}
        for c in frappe.get_all("Employee Emergency Contact", filters={"parent": me[0].name, "parenttype": "Employee"},
                                fields=["contact_name", "relation", "phone"], order_by="idx asc",
                                parent_doctype="Employee", limit_page_length=20)
    ],
}
