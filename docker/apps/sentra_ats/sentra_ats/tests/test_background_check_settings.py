import json
import time
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from sentra_ats.bgc.fetch import DEFAULT_BLOCKED_DOMAINS
from sentra_ats.sentra_ats.doctype.background_check_settings.background_check_settings import (
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
		self.settings.fetch_use_login_session = 0
		self.settings.fetch_auto_escalate = 0
		self.settings.fetch_blocked_domains = "\n".join(DEFAULT_BLOCKED_DOMAINS)
		self.settings.fetch_risk_acknowledged = 0
		self.settings.fetch_risk_ack_by = None
		self.settings.fetch_risk_ack_on = None
		self.settings.save()

		from sentra_ats.tests import ensure_test_hr_user
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
		from sentra_ats.bgc.fetch import get_blocked_domains, is_forbidden_domain
		from sentra_ats.setup import setup_default_settings

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
		from sentra_ats.sentra_ats.doctype.background_check_settings.background_check_settings import test_fetch

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

		from sentra_ats.bgc.fetch import FetchResult
		from sentra_ats.sentra_ats.doctype.background_check_settings.background_check_settings import test_fetch

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
		with patch("sentra_ats.bgc.fetch.fetch", side_effect=fake_fetch):
			res = test_fetch("https://example.com/sampleuser", consent_acknowledged=1)

		self.assertEqual(res["url"], "https://example.com/sampleuser")
		self.assertEqual(res["domain"], "example.com")
		self.assertGreaterEqual(len(res["results"]), 2)

		company_res = next(r for r in res["results"] if r["mode"] == "Company")
		self.assertEqual(company_res["status"], 200)
		self.assertEqual(company_res["title"], "Sample Profile (@user)")
		self.assertIn("Public profile description", company_res["preview_text"])
		self.assertFalse(company_res["is_login_page"])

	def test_settings_thresholds_validation(self):
		"""Validasi batasan setting: social_max_posts >= 1, social_lookback_months >= 0 (0 = tanpa batas), export_max_mb >= 1."""
		self.settings.reload()

		# Nilai 0 ditolak
		self.settings.social_max_posts = 0
		with self.assertRaises(frappe.ValidationError):
			self.settings.save()
		self.settings.reload()

		self.settings.social_max_comments = 0
		with self.assertRaises(frappe.ValidationError):
			self.settings.save()
		self.settings.reload()

		self.settings.social_lookback_months = -1
		with self.assertRaises(frappe.ValidationError):
			self.settings.save()
		self.settings.reload()

		self.settings.export_max_mb = 0
		with self.assertRaises(frappe.ValidationError):
			self.settings.save()
		self.settings.reload()

		# Nilai valid tersimpan
		self.settings.social_max_posts = 150
		self.settings.social_max_comments = 120
		self.settings.social_lookback_months = 6
		self.settings.export_max_mb = 50
		self.settings.save()
		self.settings.reload()
		self.assertEqual(self.settings.social_max_posts, 150)
		self.assertEqual(self.settings.social_max_comments, 120)
		self.assertEqual(self.settings.social_lookback_months, 6)
		self.assertEqual(self.settings.export_max_mb, 50)

	def test_settings_defaults_patch_idempotency(self):
		"""Patch mengisi default pada Single tanpa baris / 0 dan tidak menimpa nilai positif yang sudah diubah."""
		from sentra_ats.patches.v1_0.set_default_social_and_export_settings import execute as run_patch

		# 1. Simulasikan nilai belum ada atau 0
		self.settings.reload()
		self.settings.social_max_posts = 0
		self.settings.social_lookback_months = 0
		self.settings.export_max_mb = 0
		self.settings.enable_social_media = 0
		self.settings.flags.ignore_validate = True
		self.settings.save()

		# Jalankan patch
		run_patch()

		reloaded = frappe.get_doc("Background Check Settings")
		self.assertEqual(reloaded.social_max_posts, 200)
		self.assertEqual(reloaded.social_lookback_months, 0)
		self.assertEqual(reloaded.export_max_mb, 100)
		self.assertEqual(reloaded.enable_social_media, 1)

		# 2. Ubah salah satu nilai ke angka positif
		reloaded.social_max_posts = 350
		reloaded.save()

		# Jalankan patch lagi -> nilai positif (350) tidak boleh ditimpa
		run_patch()

		reloaded_again = frappe.get_doc("Background Check Settings")
		self.assertEqual(reloaded_again.social_max_posts, 350)
		self.assertEqual(reloaded_again.social_lookback_months, 0)
		self.assertEqual(reloaded_again.export_max_mb, 100)

	def test_test_fetch_session_mode_eligibility_and_comparison(self):
		"""Mode Session muncul hanya bila ada akun crawler Connected + risk acknowledged, membandingkan data dengan Browser mode, dan tidak membocorkan cookie."""
		from sentra_ats.bgc.crawler_session import save_crawler_storage_state
		from sentra_ats.bgc.fetch import FetchResult
		from sentra_ats.sentra_ats.doctype.background_check_settings.background_check_settings import test_fetch

		# Pastikan platform Instagram ada
		if not frappe.db.exists("Background Check Platform", "Instagram"):
			p = frappe.new_doc("Background Check Platform")
			p.platform_name = "Instagram"
			p.session_domains = "instagram.com\n.instagram.com"
			p.insert(ignore_permissions=True)

		# Bersihkan akun lama
		for name in frappe.get_all("Background Check Crawler Account", filters={"platform": "Instagram"}, pluck="name"):
			frappe.delete_doc("Background Check Crawler Account", name, force=True)

		self.settings.reload()
		self.settings.fetch_blocked_domains = ""
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save(ignore_permissions=True)

		# 1. Tanpa akun crawler connected -> mode Session TIDAK muncul
		fake_browser_html = "<html><title>User (@testuser) • Instagram photos</title><body><h1>User</h1><p>414 Following, 1,367 Followers, 25 Posts</p></body></html>"
		with patch("sentra_ats.bgc.fetch.fetch", return_value=FetchResult(url="https://www.instagram.com/testuser/", status=200, body=fake_browser_html, mode_used="browser")):
			res1 = test_fetch("https://www.instagram.com/testuser/", consent_acknowledged=1)
		modes1 = [r["mode"] for r in res1["results"]]
		self.assertNotIn("Session", " ".join(modes1))

		# 2. Buat akun crawler tetapi risk_acknowledged = 0 -> mode Session TIDAK muncul
		acc = frappe.new_doc("Background Check Crawler Account")
		acc.platform = "Instagram"
		acc.account_label = "IG Crawler Test"
		acc.account_handle = "ig_crawler"
		acc.enabled = 1
		acc.risk_acknowledged = 0
		acc.insert(ignore_permissions=True)

		secret_cookie = "secret_session_token_xyz"
		save_crawler_storage_state(acc.name, json.dumps({
			"cookies": [{"name": "sessionid", "value": secret_cookie, "domain": ".instagram.com", "expires": time.time() + 86400}]
		}))

		with patch("sentra_ats.bgc.fetch.fetch", return_value=FetchResult(url="https://www.instagram.com/testuser/", status=200, body=fake_browser_html, mode_used="browser")):
			res2 = test_fetch("https://www.instagram.com/testuser/", consent_acknowledged=1)
		modes2 = [r["mode"] for r in res2["results"]]
		self.assertNotIn("Session", " ".join(modes2))

		# 3. Sekarang beri risk_acknowledged = 1 pada akun dan Settings -> mode Session MUNCUL
		acc.reload()
		acc.risk_acknowledged = 1
		acc.save()

		self.settings.reload()
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save(ignore_permissions=True)

		fake_session_html = "<html><title>User (@testuser) • Instagram photos</title><body><h1>User</h1><p>Bio details</p><article>Post 1</article><article>Post 2</article></body></html>"

		def mocked_fetch(url, *args, **kwargs):
			cfg = kwargs.get("config")
			if cfg and cfg.storage_state:
				# Mode session
				return FetchResult(url=url, status=200, body=fake_session_html, mode_used="browser", from_cache=False)
			return FetchResult(url=url, status=200, body=fake_browser_html, mode_used="browser", from_cache=False)

		with patch("sentra_ats.bgc.fetch.fetch", side_effect=mocked_fetch):
			res3 = test_fetch("https://www.instagram.com/testuser/", consent_acknowledged=1)

		modes3 = [r["mode"] for r in res3["results"]]
		session_mode_found = any("Session" in m for m in modes3)
		self.assertTrue(session_mode_found, f"Mode Session harus muncul di {modes3}")

		session_res = next(r for r in res3["results"] if "Session" in r["mode"])
		self.assertEqual(session_res["account_label"], "IG Crawler Test")
		self.assertIsNotNone(session_res.get("comparison_with_browser"))
		self.assertIn("posts_count", session_res["comparison_with_browser"])
		self.assertIn("has_name", session_res["comparison_with_browser"])

		# Pastikan TIDAK ADA cookie rahasia yang bocor di respons
		res_json = json.dumps(res3)
		self.assertNotIn(secret_cookie, res_json)

	def test_test_fetch_session_challenge_marks_account_status(self):
		"""Mode Session yang menemui checkpoint/challenge mengubah status akun ke Challenge."""
		from sentra_ats.bgc.crawler_session import save_crawler_storage_state
		from sentra_ats.bgc.fetch import FetchResult
		from sentra_ats.sentra_ats.doctype.background_check_settings.background_check_settings import test_fetch

		self.settings.reload()
		self.settings.fetch_blocked_domains = ""
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save(ignore_permissions=True)

		acc = frappe.new_doc("Background Check Crawler Account")
		acc.platform = "Instagram"
		acc.account_label = "IG Challenge Test"
		acc.account_handle = "ig_chall"
		acc.enabled = 1
		acc.risk_acknowledged = 1
		acc.insert(ignore_permissions=True)

		save_crawler_storage_state(acc.name, json.dumps({
			"cookies": [{"name": "sessionid", "value": "val123", "domain": ".instagram.com", "expires": time.time() + 86400}]
		}))

		challenge_url = "https://www.instagram.com/challenge/action/?challenge_context=xyz"
		challenge_html = "<html><title>Instagram • Challenge Required</title><body><form action='/checkpoint'></form></body></html>"

		def mock_challenge(url, *args, **kwargs):
			cfg = kwargs.get("config")
			if cfg and cfg.storage_state:
				return FetchResult(url=challenge_url, status=403, body=challenge_html, mode_used="browser")
			return FetchResult(url=url, status=200, body="<html><title>Profile</title></html>", mode_used="browser")

		with patch("sentra_ats.bgc.fetch.fetch", side_effect=mock_challenge):
			test_fetch("https://www.instagram.com/robbyimamp/", consent_acknowledged=1)

		acc.reload()
		self.assertEqual(acc.status, "Challenge")
		self.assertIn("challenge", (acc.last_error or "").lower())


