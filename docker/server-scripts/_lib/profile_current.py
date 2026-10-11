# --- @lib profile_current: data pribadi saat ini untuk Employee `target_emp` -> cur ---
cur_e = frappe.get_all("Employee", filters={"name": target_emp},
                       fields=["cell_number", "personal_email", "current_address"], limit_page_length=1)[0]
cur = {
    "phone": cur_e.cell_number or "",
    "personal_email": cur_e.personal_email or "",
    "address": cur_e.current_address or "",
    "emergency_contacts": [
        {"contact_name": c.contact_name, "relation": c.relation, "phone": c.phone}
        for c in frappe.get_all("Employee Emergency Contact", filters={"parent": target_emp, "parenttype": "Employee"},
                                fields=["contact_name", "relation", "phone"], order_by="idx asc",
                                parent_doctype="Employee", limit_page_length=20)
    ],
    "family": [
        {"member_name": m.member_name, "relation": m.relation,
         "date_of_birth": str(m.date_of_birth) if m.date_of_birth else None,
         "is_dependent": 1 if m.is_dependent else 0}
        for m in frappe.get_all("Employee Family Member", filters={"parent": target_emp, "parenttype": "Employee"},
                                fields=["member_name", "relation", "date_of_birth", "is_dependent"], order_by="idx asc",
                                parent_doctype="Employee", limit_page_length=20)
    ],
}
# --- end @lib profile_current ---
