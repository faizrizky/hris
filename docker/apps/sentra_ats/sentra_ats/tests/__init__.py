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


def ensure_test_bgc_officer_user(email: str = "bgc.officer.test@example.com") -> str:
	"""Memastikan user test Background Check Officer murni tersedia."""
	if not frappe.db.exists("User", email):
		user = frappe.new_doc("User")
		user.email = email
		user.first_name = "BGC Officer Test"
		user.flags.no_welcome_mail = True
		user.append("roles", {"role": "Background Check Officer"})
		user.append("roles", {"role": "Employee"})
		user.insert(ignore_permissions=True)
	else:
		u = frappe.get_doc("User", email)
		existing_roles = {r.role for r in u.roles}
		if "Background Check Officer" not in existing_roles:
			u.append("roles", {"role": "Background Check Officer"})
			u.save(ignore_permissions=True)
	return email


def ensure_test_company(company_name: str = "_Test Company") -> str:
	"""Memastikan default company tersedia di site pengujian untuk DocType HRMS seperti Job Opening."""
	if not frappe.db.exists("Company", company_name):
		if not frappe.db.exists("Warehouse Type", "Transit"):
			try:
				frappe.get_doc({"doctype": "Warehouse Type", "name": "Transit"}).insert(ignore_permissions=True)
			except Exception:
				pass
		comp = frappe.new_doc("Company")
		comp.company_name = company_name
		comp.abbr = "_TC"
		comp.default_currency = "IDR"
		comp.country = "Indonesia"
		comp.flags.ignore_mandatory = True
		comp.flags.ignore_validate = True
		try:
			comp.insert(ignore_permissions=True)
		except Exception:
			# Fallback raw insert jika hook ERPNext warehouse gagal
			frappe.db.sql(
				"""INSERT IGNORE INTO `tabCompany` (name, company_name, abbr, default_currency, country, docstatus)
				VALUES (%s, %s, %s, %s, %s, 0)""",
				(company_name, company_name, "_TC", "IDR", "Indonesia"),
			)
	default_comp = frappe.db.get_single_value("Global Defaults", "default_company")
	if not default_comp:
		frappe.db.set_single_value("Global Defaults", "default_company", company_name)
	return company_name


def ensure_test_encryption_key() -> str:
	"""Memastikan site pengujian memiliki encryption_key acak unik (Fernet.generate_key()) dan bukan salinan dari site lain."""
	if hasattr(frappe, "local") and frappe.local:
		conf = getattr(frappe.local, "conf", None) or {}
		if not conf.get("encryption_key") and not conf.get("secret_key"):
			from cryptography.fernet import Fernet

			key = Fernet.generate_key().decode("utf-8")
			conf["encryption_key"] = key
			try:
				from frappe.installer import update_site_config

				update_site_config("encryption_key", key)
			except Exception:
				pass
			return key
		return conf.get("encryption_key") or conf.get("secret_key") or ""
	return ""


def assert_test_site():
	"""Penjaga pengujian: menolak berjalan bila site aktif bukan site uji yang berawalan ats-test."""
	site = getattr(getattr(frappe, "local", None), "site", "") or ""
	if not site.startswith("ats-test"):
		raise RuntimeError(
			f"REFUSING TO RUN TESTS: Current site is '{site}'. "
			"Tests must ONLY be run on test sites starting with 'ats-test' (e.g. ats-test.localhost). "
			"Testing against production or development sites (such as hris.localhost) is strictly forbidden."
		)


# Pasang penjaga ke FrappeTestCase agar semua test class otomatis menolak berjalan di luar ats-test*
try:
	from frappe.tests.utils import FrappeTestCase

	_orig_setup = FrappeTestCase.setUp
	_orig_setup_class = getattr(FrappeTestCase, "setUpClass", None)

	def _guarded_setup(self, *args, **kwargs):
		assert_test_site()
		return _orig_setup(self, *args, **kwargs)

	FrappeTestCase.setUp = _guarded_setup

	if _orig_setup_class:

		@classmethod
		def _guarded_setup_class(cls, *args, **kwargs):
			assert_test_site()
			return _orig_setup_class(*args, **kwargs)

		FrappeTestCase.setUpClass = _guarded_setup_class
except Exception:
	pass

