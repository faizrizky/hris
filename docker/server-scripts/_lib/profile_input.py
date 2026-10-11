# --- @lib profile_input: parse + validasi data pribadi dari frappe.form_dict ---
# Hasil: p_fields (nama field Employee -> nilai/None), ec_rows (None atau daftar kontak darurat),
# fam_rows (None atau daftar anggota keluarga). Dipakai bersama oleh update / submit change request.
fd = frappe.form_dict
p_mapping = {
    "phone": ("cell_number", 20),
    "personal_email": ("personal_email", 140),
    "address": ("current_address", 500),
    "em2_name": ("custom_em2_name", 140),
    "em2_relation": ("custom_em2_relation", 60),
    "em2_phone": ("custom_em2_phone", 20),
}
p_fields = {}
for key in p_mapping:
    if key in fd:
        val = fd.get(key)
        val = "" if val is None else str(val).strip()
        if len(val) > p_mapping[key][1]:
            frappe.throw(key + " is too long (max " + str(p_mapping[key][1]) + " characters)")
        if key == "personal_email" and val:
            at = val.find("@")
            if at < 1 or "." not in val[at:] or " " in val or val.endswith(".") or val.count("@") != 1:
                frappe.throw("Invalid email format")
        if key in ("phone", "em2_phone") and val:
            for ch in val:
                if ch not in "0123456789+-() ":
                    frappe.throw("Invalid phone number format")
        p_fields[p_mapping[key][0]] = val if val else None

if "marital_status" in fd:
    ms = str(fd.get("marital_status") or "").strip()
    if ms not in ("Single", "Married", "Divorced", "Widowed"):
        frappe.throw("marital_status must be Single, Married, Divorced or Widowed")
    p_fields["marital_status"] = ms

ec_rows = None
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
    ec_rows = []
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
        ec_rows.append({"contact_name": it[0], "relation": rel, "phone": it[2]})

fam_rows = None
if "family" in fd:
    rawf = fd.get("family")
    fitems = []
    if isinstance(rawf, list):
        for c in rawf:
            fitems.append([str(c.get("member_name") or "").strip(), str(c.get("relation") or "").strip(),
                           str(c.get("date_of_birth") or "").strip(), str(c.get("is_dependent") or "0").strip()])
    elif rawf:
        for part in str(rawf).split(";"):
            if not part.strip():
                continue
            bits = [b.strip() for b in part.split("|")]
            while len(bits) < 4:
                bits.append("")
            fitems.append(bits[:4])
    if len(fitems) > 10:
        frappe.throw("At most 10 family members are allowed")
    rel_ok = ["Spouse", "Child", "Father", "Mother", "Sibling", "Other"]
    fam_rows = []
    for it in fitems:
        if not it[0]:
            frappe.throw("Family member name is required")
        if len(it[0]) > 140:
            frappe.throw("Family member name is too long (max 140 characters)")
        dob = None
        if it[2]:
            if len(it[2]) != 10 or it[2][4] != "-" or it[2][7] != "-" or not (it[2][:4] + it[2][5:7] + it[2][8:]).isdigit():
                frappe.throw("Invalid date of birth (use YYYY-MM-DD)")
            if frappe.utils.getdate(it[2]) > frappe.utils.getdate(frappe.utils.nowdate()):
                frappe.throw("Date of birth cannot be in the future")
            dob = it[2]
        fam_rows.append({"member_name": it[0], "relation": it[1] if it[1] in rel_ok else "Other",
                         "date_of_birth": dob, "is_dependent": 1 if it[3] in ("1", "true", "True") else 0})
# --- end @lib profile_input ---
