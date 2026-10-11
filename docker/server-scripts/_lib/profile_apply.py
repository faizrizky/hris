# --- @lib profile_apply: terapkan p_fields / ec_rows / fam_rows ke Employee `target_emp` ---
if p_fields:
    frappe.db.set_value("Employee", target_emp, p_fields)
if ec_rows is not None or fam_rows is not None:
    emp_doc = frappe.get_doc("Employee", target_emp)
    if ec_rows is not None:
        emp_doc.set("custom_emergency_contacts", ec_rows)
    if fam_rows is not None:
        emp_doc.set("custom_family_members", fam_rows)
    emp_doc.flags.ignore_permissions = True
    emp_doc.flags.ignore_mandatory = True
    emp_doc.save()
# --- end @lib profile_apply ---
