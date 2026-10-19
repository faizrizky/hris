# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import json
import time
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, now_datetime

from hris_ats.bgc.crawler_session import (
	disconnect_account,
	filter_and_validate_cookies,
	get_crawler_accounts_list,
	get_decrypted_storage_state,
	save_crawler_storage_state,
	start_login_session,
)
from hris_ats.bgc.crawler_session import (
	test_account_session as api_test_account_session,
)


class TestCrawlerAccount(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		from hris_ats.tests import ensure_test_encryption_key

		ensure_test_encryption_key()
		# Ensure test platform Instagram exists with login_url and session_domains
		if not frappe.db.exists("Background Check Platform", "Instagram"):
			p = frappe.new_doc("Background Check Platform")
			p.platform_name = "Instagram"
			p.category = "Social Media"
			p.requires_social_consent = 1
			p.login_url = "https://www.instagram.com/accounts/login/"
			p.session_domains = "instagram.com\n.instagram.com"
			p.save(ignore_permissions=True)
		else:
			p = frappe.get_doc("Background Check Platform", "Instagram")
			p.login_url = "https://www.instagram.com/accounts/login/"
			p.session_domains = "instagram.com\n.instagram.com"
			p.save(ignore_permissions=True)

		# Clear any existing crawler accounts for Instagram in test
		for acc_name in frappe.get_all("Background Check Crawler Account", filters={"platform": "Instagram"}, pluck="name"):
			frappe.delete_doc("Background Check Crawler Account", acc_name, force=True)

		# Ensure settings has risk acknowledged for tests that need it
		self.settings = frappe.get_single("Background Check Settings")
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save(ignore_permissions=True)

	def tearDown(self):
		frappe.set_user("Administrator")
		for acc_name in frappe.get_all("Background Check Crawler Account", filters={"platform": "Instagram"}, pluck="name"):
			frappe.delete_doc("Background Check Crawler Account", acc_name, force=True)
		frappe.db.rollback()

	def _create_crawler_account(self, label="Test IG Crawler", handle="company_crawler", enabled=1, risk_ack=1):
		acc = frappe.new_doc("Background Check Crawler Account")
		acc.platform = "Instagram"
		acc.account_label = label
		acc.account_handle = handle
		acc.enabled = enabled
		acc.risk_acknowledged = risk_ack
		acc.insert(ignore_permissions=True)
		return acc

	def test_permissions_system_manager_only(self):
		"""HR Manager dan Background Check Officer tidak memiliki izin baca/tulis ke Crawler Account."""
		from hris_ats.tests import ensure_test_bgc_officer_user, ensure_test_hr_user

		hr_user = ensure_test_hr_user("hr.test.crawler@example.com")
		bgc_user = ensure_test_bgc_officer_user("bgc.test.crawler@example.com")

		acc = self._create_crawler_account()

		# System Manager can read and write
		frappe.set_user("Administrator")
		self.assertTrue(frappe.has_permission("Background Check Crawler Account", "read"))
		self.assertTrue(frappe.has_permission("Background Check Crawler Account", "write"))

		# HR Manager cannot read or write
		frappe.set_user(hr_user)
		self.assertFalse(frappe.has_permission("Background Check Crawler Account", "read"))
		self.assertFalse(frappe.has_permission("Background Check Crawler Account", "write"))

		# BGC Officer cannot read or write
		frappe.set_user(bgc_user)
		self.assertFalse(frappe.has_permission("Background Check Crawler Account", "read"))
		self.assertFalse(frappe.has_permission("Background Check Crawler Account", "write"))

		# Non-System Manager calling start_login_session is rejected
		with self.assertRaises(frappe.PermissionError):
			start_login_session(acc.name)

	def test_single_active_account_per_platform(self):
		"""Hanya satu akun aktif (enabled = 1) per platform."""
		acc1 = self._create_crawler_account(label="Crawler 1", handle="c1", enabled=1)
		self.assertTrue(acc1.enabled)

		# Second active account on same platform must fail validation
		with self.assertRaises(frappe.ValidationError):
			self._create_crawler_account(label="Crawler 2", handle="c2", enabled=1)

		# Can create disabled account on same platform
		acc2 = self._create_crawler_account(label="Crawler 2", handle="c2", enabled=0)
		self.assertEqual(acc2.enabled, 0)

		# Enabling acc2 while acc1 is active must fail
		acc2.enabled = 1
		with self.assertRaises(frappe.ValidationError):
			acc2.save()

		# Disabling acc1 allows acc2 to be enabled
		acc1.reload()
		acc1.enabled = 0
		acc1.save()

		acc2.reload()
		acc2.enabled = 1
		acc2.save()
		self.assertEqual(acc2.reload().enabled, 1)

	def test_risk_acknowledgment_enforcement(self):
		"""Login ditolak tanpa risk_acknowledged pada akun dan pada Settings."""
		acc = self._create_crawler_account(risk_ack=0)

		# 1. Account risk acknowledgment missing
		with self.assertRaises(frappe.ValidationError) as ctx:
			start_login_session(acc.name)
		self.assertIn("Account risk acknowledgment is required", str(ctx.exception))

		# 2. Account risk acknowledged but Settings risk not acknowledged
		acc.risk_acknowledged = 1
		acc.save()

		self.settings.fetch_risk_acknowledged = 0
		self.settings.save(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError) as ctx:
			start_login_session(acc.name)
		self.assertIn("Risk acknowledgment in Background Check Settings is required", str(ctx.exception))

	def test_filter_and_validate_cookies_restricts_to_session_domains(self):
		"""Cookie difilter strictly ke platform.session_domains dan domain di luar dibuang."""
		raw_storage_state = {
			"cookies": [
				{"name": "sessionid", "value": "secret123", "domain": ".instagram.com", "expires": time.time() + 86400},
				{"name": "csrftoken", "value": "csrfabc", "domain": "instagram.com", "expires": time.time() + 86400},
				{"name": "evil_tracker", "value": "bad", "domain": ".attacker.com", "expires": time.time() + 86400},
				{"name": "google_analytics", "value": "ga123", "domain": ".google.com", "expires": time.time() + 86400},
			]
		}
		session_domains = "instagram.com\n.instagram.com"

		filtered, found_domains, _expires_on = filter_and_validate_cookies(raw_storage_state, session_domains)

		cookie_domains = [c["domain"] for c in filtered["cookies"]]
		self.assertIn(".instagram.com", cookie_domains)
		self.assertIn("instagram.com", cookie_domains)
		self.assertNotIn(".attacker.com", cookie_domains)
		self.assertNotIn(".google.com", cookie_domains)
		self.assertEqual(len(filtered["cookies"]), 2)
		self.assertIn(".instagram.com", found_domains)

	def test_save_storage_state_encryption_and_sanitization(self):
		"""Sesi tersimpan terenkripsi, tidak bocor di as_dict, dan bisa didekripsi internal."""
		acc = self._create_crawler_account()

		sample_state = {
			"cookies": [
				{"name": "sessionid", "value": "super_secret_cookie_val", "domain": ".instagram.com", "expires": time.time() + 86400},
			]
		}

		res = save_crawler_storage_state(acc.name, json.dumps(sample_state))
		self.assertEqual(res["status"], "Connected")
		self.assertIn(".instagram.com", res["cookie_domains_found"])

		acc.reload()
		self.assertEqual(acc.status, "Connected")
		self.assertEqual(acc.connected_by, "Administrator")
		self.assertIsNotNone(acc.session_expires_on)

		# Verify as_dict does NOT contain plain session credentials
		doc_dict = acc.as_dict()
		self.assertFalse(doc_dict.get("session"))

		# Verify internal decrypted access works
		decrypted = get_decrypted_storage_state(acc.name)
		self.assertIsNotNone(decrypted)
		self.assertEqual(decrypted["cookies"][0]["value"], "super_secret_cookie_val")

	def test_disconnect_account_clears_session(self):
		"""Disconnect menghapus session, mengubah status menjadi 'Not connected'."""
		acc = self._create_crawler_account()
		sample_state = {
			"cookies": [
				{"name": "sessionid", "value": "val123", "domain": ".instagram.com", "expires": time.time() + 86400},
			]
		}
		save_crawler_storage_state(acc.name, json.dumps(sample_state))
		self.assertEqual(acc.reload().status, "Connected")

		res = disconnect_account(acc.name)
		self.assertEqual(res["status"], "Not connected")

		acc.reload()
		self.assertEqual(acc.status, "Not connected")
		self.assertIsNone(get_decrypted_storage_state(acc.name))

	def test_test_account_session(self):
		"""Test session memverifikasi status koneksi dan kedaluwarsa cookie."""
		acc = self._create_crawler_account()

		# Not connected
		res = api_test_account_session(acc.name)
		self.assertEqual(res["status"], "Not connected")

		# Connected with active cookie
		active_state = {
			"cookies": [
				{"name": "sessionid", "value": "val123", "domain": ".instagram.com", "expires": time.time() + 86400},
			]
		}
		save_crawler_storage_state(acc.name, json.dumps(active_state))
		res = api_test_account_session(acc.name)
		self.assertEqual(res["status"], "Connected")
		self.assertEqual(res["cookie_count"], 1)

		# Connected with expired cookie
		expired_state = {
			"cookies": [
				{"name": "sessionid", "value": "val123", "domain": ".instagram.com", "expires": time.time() - 100},
			]
		}
		save_crawler_storage_state(acc.name, json.dumps(expired_state))
		res = api_test_account_session(acc.name)
		self.assertEqual(res["status"], "Expired")
		self.assertEqual(acc.reload().status, "Expired")

	def test_get_crawler_accounts_list_sanitization(self):
		"""get_crawler_accounts_list mengembalikan metadata akun tanpa kolom session."""
		acc = self._create_crawler_account()
		sample_state = {
			"cookies": [
				{"name": "sessionid", "value": "secret", "domain": ".instagram.com", "expires": time.time() + 86400},
			]
		}
		save_crawler_storage_state(acc.name, json.dumps(sample_state))

		accounts = get_crawler_accounts_list()
		matching = [a for a in accounts if a["name"] == acc.name]
		self.assertEqual(len(matching), 1)
		acc_meta = matching[0]
		self.assertNotIn("session", acc_meta)
		self.assertEqual(acc_meta["status"], "Connected")
		self.assertEqual(acc_meta["platform"], "Instagram")

	def test_crawler_limits_validation(self):
		"""Validasi batasan limit crawler: hourly >= 1, daily >= 1, delay >= 0, jitter >= 0."""
		acc = self._create_crawler_account()

		# hourly_limit < 1 ditolak
		acc.hourly_limit = 0
		with self.assertRaises(frappe.ValidationError):
			acc.save()
		acc.reload()

		# daily_limit < 1 ditolak
		acc.daily_limit = 0
		with self.assertRaises(frappe.ValidationError):
			acc.save()
		acc.reload()

		# min_delay_seconds < 0 ditolak
		acc.min_delay_seconds = -1
		with self.assertRaises(frappe.ValidationError):
			acc.save()
		acc.reload()

		# jitter_seconds < 0 ditolak
		acc.jitter_seconds = -1
		with self.assertRaises(frappe.ValidationError):
			acc.save()
		acc.reload()

		# Nilai valid tersimpan sukses
		acc.hourly_limit = 10
		acc.daily_limit = 50
		acc.min_delay_seconds = 15
		acc.jitter_seconds = 20
		acc.save()
		acc.reload()
		self.assertEqual(acc.hourly_limit, 10)
		self.assertEqual(acc.daily_limit, 50)
		self.assertEqual(acc.min_delay_seconds, 15)
		self.assertEqual(acc.jitter_seconds, 20)

	def test_no_cookies_written_to_redis_during_session_completion(self):
		"""Memastikan cookies tidak pernah ditulis ke Redis saat worker menyimpan session (Zero-Redis Cookie Flow)."""
		from hris_ats.bgc.crawler_session import get_redis_client

		acc = self._create_crawler_account()
		secret_token = f"sensitive_cookie_{frappe.generate_hash()}"
		raw_session = json.dumps({
			"cookies": [
				{"name": "sessionid", "value": secret_token, "domain": ".instagram.com", "expires": time.time() + 86400}
			]
		})

		redis = get_redis_client()
		session_id = frappe.generate_hash(length=12)

		# Worker saves session directly into account without passing through Redis
		res = save_crawler_storage_state(acc.name, raw_session)
		self.assertEqual(res["status"], "Connected")

		# Check Redis to ensure no crawler_result key exists and secret_token was never written
		self.assertIsNone(redis.get_value(f"crawler_result:{session_id}", use_local_cache=False))

		# Search all keys in Redis for the sensitive secret token
		all_keys = redis.get_keys("crawler_*")
		for k in all_keys:
			val = redis.get_value(k, use_local_cache=False)
			if val:
				val_str = str(val)
				self.assertNotIn(secret_token, val_str, f"Leaked cookie found in Redis key: {k}")

	def test_regression_frappe_local_cache_bypass(self):
		"""Regression test untuk bug frappe.local.cache yang dulu menyimpan None selamanya."""
		from hris_ats.bgc.crawler_session import get_redis_client

		redis = get_redis_client()
		test_key = f"test_cache_bug_{frappe.generate_hash(length=8)}"

		# Pastikan kunci belum ada di Redis
		redis.delete_value(test_key)

		# 1. Panggilan pertama mengembalikan None
		val1 = redis.get_value(test_key, use_local_cache=False)
		self.assertIsNone(val1)

		# 2. Worker atau proses lain mengisi kunci di Redis
		redis.set_value(test_key, "complete", expires_in_sec=30)

		# 3. Panggilan kedua dengan use_local_cache=False WAJIB membaca nilai terbaru ("complete"),
		# tidak tertahan oleh None di frappe.local.cache
		val2 = redis.get_value(test_key, use_local_cache=False)
		self.assertEqual(val2, "complete")

		# Bersihkan
		redis.delete_value(test_key)

