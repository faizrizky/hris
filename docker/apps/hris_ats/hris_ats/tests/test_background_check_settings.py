# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import (
	get_scrapling_browser_status,
)


class TestBackgroundCheckSettings(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		self.settings = frappe.get_doc("Background Check Settings")
		# Reset to default
		self.settings.fetch_respect_robots = 1
		self.settings.fetch_identity = "Company"
		self.settings.fetch_stealth_mode = 0
		self.settings.fetch_risk_acknowledged = 0
		self.settings.fetch_risk_ack_by = None
		self.settings.fetch_risk_ack_on = None
		self.settings.save()

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_browser_status_onload(self):
		"""Memastikan status browser Scrapling terdeteksi di controller."""
		status = get_scrapling_browser_status()
		self.assertIn(status, ["Terpasang", "Tidak terpasang"])

		self.settings.onload()
		self.assertEqual(self.settings.fetch_browser_status, status)

	def test_default_user_agent_format(self):
		"""Memastikan user agent default memuat identitas perusahaan atau fallback HRIS."""
		ua = self.settings.get_default_user_agent()
		self.assertIn("HR Background Check (+hr@example.com)", ua)

	def test_risky_switches_rejected_without_risk_acknowledged(self):
		"""Menyimpan saklar berisiko tanpa mencentang pengakuan risiko harus ditolak."""
		# 1. Respect robots dimatikan
		self.settings.fetch_respect_robots = 0
		self.settings.fetch_risk_acknowledged = 0
		with self.assertRaises(frappe.ValidationError):
			self.settings.save()

		# Reset
		self.settings.reload()

		# 2. Identitas Browser
		self.settings.fetch_identity = "Browser"
		self.settings.fetch_risk_acknowledged = 0
		with self.assertRaises(frappe.ValidationError):
			self.settings.save()

		# Reset
		self.settings.reload()

		# 3. Stealth mode diaktifkan
		self.settings.fetch_stealth_mode = 1
		self.settings.fetch_risk_acknowledged = 0
		with self.assertRaises(frappe.ValidationError):
			self.settings.save()

	def test_risky_switches_allowed_with_risk_acknowledged_and_auto_fills_ack(self):
		"""Menyimpan saklar berisiko dengan pengakuan risiko berhasil dan mengisi ack_by & ack_on otomatis."""
		self.settings.fetch_identity = "Browser"
		self.settings.fetch_respect_robots = 0
		self.settings.fetch_stealth_mode = 1
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save()

		self.settings.reload()
		self.assertEqual(self.settings.fetch_identity, "Browser")
		self.assertEqual(self.settings.fetch_respect_robots, 0)
		self.assertEqual(self.settings.fetch_stealth_mode, 1)
		self.assertEqual(self.settings.fetch_risk_acknowledged, 1)
		self.assertEqual(self.settings.fetch_risk_ack_by, "Administrator")
		self.assertIsNotNone(self.settings.fetch_risk_ack_on)

	def test_switches_reverted_to_default_keeps_risk_acknowledgment(self):
		"""Bila semua saklar kembali ke default, pengakuan risiko tetap tersimpan."""
		self.settings.fetch_identity = "Browser"
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save()

		self.settings.reload()
		ack_by = self.settings.fetch_risk_ack_by
		ack_on = self.settings.fetch_risk_ack_on

		# Kembalikan semua saklar ke default
		self.settings.fetch_identity = "Company"
		self.settings.save()

		self.settings.reload()
		self.assertEqual(self.settings.fetch_identity, "Company")
		self.assertEqual(self.settings.fetch_risk_acknowledged, 1)
		self.assertEqual(self.settings.fetch_risk_ack_by, ack_by)
		self.assertEqual(self.settings.fetch_risk_ack_on, ack_on)

	def test_permlevel_hr_manager_cannot_modify_system_manager_can(self):
		"""HR Manager hanya bisa membaca permlevel 1, System Manager bisa membaca dan menulis."""
		# Pastikan user hr.test@example.com ada
		self.assertTrue(frappe.db.exists("User", "hr.test@example.com"))

		# 1. Cek hak akses permlevel 1 via has_permlevel_access_to
		frappe.set_user("hr.test@example.com")
		hr_doc = frappe.get_doc("Background Check Settings")
		self.assertTrue(hr_doc.has_permlevel_access_to("fetch_respect_robots", permission_type="read"))
		self.assertFalse(hr_doc.has_permlevel_access_to("fetch_respect_robots", permission_type="write"))

		frappe.set_user("Administrator")
		admin_doc = frappe.get_doc("Background Check Settings")
		self.assertTrue(admin_doc.has_permlevel_access_to("fetch_respect_robots", permission_type="read"))
		self.assertTrue(admin_doc.has_permlevel_access_to("fetch_respect_robots", permission_type="write"))

		# 2. Coba simpan perubahan permlevel 1 sebagai HR Manager -> perubahan direset (tidak tersimpan)
		frappe.set_user("hr.test@example.com")
		hr_doc = frappe.get_doc("Background Check Settings")
		hr_doc.fetch_respect_robots = 0
		hr_doc.save()

		reloaded = frappe.get_doc("Background Check Settings")
		self.assertEqual(reloaded.fetch_respect_robots, 1)

		# 3. Simpan perubahan permlevel 1 sebagai System Manager (Administrator) -> tersimpan
		frappe.set_user("Administrator")
		admin_doc = frappe.get_doc("Background Check Settings")
		admin_doc.fetch_respect_robots = 0
		admin_doc.fetch_risk_acknowledged = 1
		admin_doc.save()

		admin_reloaded = frappe.get_doc("Background Check Settings")
		self.assertEqual(admin_reloaded.fetch_respect_robots, 0)
