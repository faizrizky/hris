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

		from hris_ats.tests import ensure_test_hr_user
		ensure_test_hr_user("hr.test@example.com")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_browser_status_onload(self):
		"""Memastikan status browser Scrapling terdeteksi di controller."""
		status = get_scrapling_browser_status()
		self.assertIn(status, ["Installed", "Not installed"])

		self.settings.onload()
		self.assertEqual(self.settings.fetch_browser_status, status)

	def test_default_user_agent_format(self):
		"""Memastikan user agent default memuat identitas perusahaan atau fallback HRIS."""
		ua = self.settings.get_default_user_agent()
		self.assertTrue("HR Background Check (+hr@example.com)" in ua or "HRIS Background Check (+hr@example.com)" in ua)

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

	def test_removing_default_blocked_domain_rejected_without_risk_ack(self):
		"""3a: Menghapus domain bawaan dari daftar terblokir ditolak tanpa pengakuan risiko."""
		# Hapus instagram.com dari fetch_blocked_domains
		curr_domains = [d for d in self.settings.fetch_blocked_domains.splitlines() if d.strip() and d.strip() != "instagram.com"]
		self.settings.fetch_blocked_domains = "\n".join(curr_domains)
		self.settings.fetch_risk_acknowledged = 0

		with self.assertRaises(frappe.ValidationError):
			self.settings.save()

		# Reset dan coba dengan fetch_risk_acknowledged = 1
		self.settings.reload()
		self.settings.fetch_blocked_domains = "\n".join(curr_domains)
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save()

		self.settings.reload()
		self.assertNotIn("instagram.com", self.settings.fetch_blocked_domains)
		self.assertEqual(self.settings.fetch_risk_acknowledged, 1)

	def test_emptied_blocked_domains_stay_empty_after_save_and_setup(self):
		"""Daftar yang sengaja dikosongkan tidak diisi ulang oleh validate, onload, maupun setup."""
		from hris_ats.bgc.fetch import get_blocked_domains, is_forbidden_domain
		from hris_ats.setup import setup_default_settings

		# Mengosongkan seluruh daftar tanpa pengakuan risiko ditolak
		self.settings.fetch_blocked_domains = ""
		self.settings.fetch_risk_acknowledged = 0
		with self.assertRaises(frappe.ValidationError):
			self.settings.save()

		# Dengan pengakuan risiko: tersimpan kosong dan tetap kosong
		self.settings.reload()
		self.settings.fetch_blocked_domains = ""
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save()

		reloaded = frappe.get_doc("Background Check Settings")
		reloaded.onload()
		self.assertEqual(reloaded.fetch_blocked_domains or "", "")
		self.assertEqual(get_blocked_domains(), [])
		self.assertFalse(is_forbidden_domain("https://www.instagram.com/tim"))

		# Migrate/setup berikutnya tidak boleh mengisinya kembali
		setup_default_settings()
		self.assertEqual(get_blocked_domains(), [])

	def test_test_fetch_permissions_and_validation(self):
		"""3c: Uji tombol Test Fetch - hak akses dan validasi input."""
		from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import test_fetch

		# 1. Non-System Manager ditolak
		frappe.set_user("hr.test@example.com")
		with self.assertRaises(frappe.PermissionError):
			test_fetch("https://example.com/user", consent_acknowledged=1)

		# 2. Administrator (System Manager) tanpa centang persetujuan ditolak
		frappe.set_user("Administrator")
		with self.assertRaises(frappe.ValidationError):
			test_fetch("https://example.com/user", consent_acknowledged=0)

		# 3. URL tanpa skema http/https ditolak
		with self.assertRaises(frappe.ValidationError):
			test_fetch("ftp://example.com/user", consent_acknowledged=1)

		# 4. Domain yang masih diblokir di Settings ditolak
		with self.assertRaises(frappe.ValidationError):
			test_fetch("https://www.instagram.com/user", consent_acknowledged=1)

	def test_test_fetch_execution_with_mocked_network(self):
		"""3c: Uji tombol Test Fetch dengan jaringan di-mock pada 3 mode (Company, Browser, Stealth)."""
		from unittest.mock import patch

		from hris_ats.bgc.fetch import FetchResult
		from hris_ats.hris_ats.doctype.background_check_settings.background_check_settings import test_fetch

		fake_html = "<html><title>Sample Profile (@user)</title><body><h1>Sample User</h1><p>Public profile description.</p></body></html>"

		def fake_fetch(url, *args, **kwargs):
			cfg = kwargs.get("config")
			mode = cfg.identity.lower() if cfg else "company"
			if cfg and cfg.stealth:
				mode = "stealth"
			return FetchResult(
				url=url,
				status=200,
				body=fake_html,
				mode_used=mode,
				robots_ignored=False,
				from_cache=False,
			)

		frappe.set_user("Administrator")
		with patch("hris_ats.bgc.fetch.fetch", side_effect=fake_fetch):
			res = test_fetch("https://example.com/sampleuser", consent_acknowledged=1)

		self.assertEqual(res["url"], "https://example.com/sampleuser")
		self.assertEqual(res["domain"], "example.com")
		self.assertGreaterEqual(len(res["results"]), 2)

		company_res = next(r for r in res["results"] if r["mode"] == "Company")
		self.assertEqual(company_res["status"], 200)
		self.assertEqual(company_res["title"], "Sample Profile (@user)")
		self.assertIn("Public profile description", company_res["preview_text"])
		self.assertFalse(company_res["is_login_page"])

