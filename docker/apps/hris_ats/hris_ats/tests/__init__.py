# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import frappe


def ensure_test_hr_user(email: str = "hr.test@example.com") -> str:
	"""Memastikan user test HR Manager / BGC Officer tersedia dengan role yang sesuai."""
	if not frappe.db.exists("User", email):
		user = frappe.new_doc("User")
		user.email = email
		user.first_name = "HR Test"
		user.flags.no_welcome_mail = True
		user.append("roles", {"role": "HR Manager"})
		user.append("roles", {"role": "Background Check Officer"})
		user.append("roles", {"role": "HR User"})
		user.append("roles", {"role": "Employee"})
		user.insert(ignore_permissions=True)
	else:
		u = frappe.get_doc("User", email)
		existing_roles = {r.role for r in u.roles}
		modified = False
		for r in ("HR Manager", "Background Check Officer", "HR User", "Employee"):
			if r not in existing_roles:
				u.append("roles", {"role": r})
				modified = True
		if modified:
			u.save(ignore_permissions=True)
	return email
