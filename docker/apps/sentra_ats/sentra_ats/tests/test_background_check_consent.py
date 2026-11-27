# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import json
from datetime import timedelta

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import now_datetime

from sentra_ats.bgc.consent import (
	initiate_background_check,
	revoke_consent,
	submit_candidate_consent,
)


class TestBackgroundCheckConsent(FrappeTestCase):
	def setUp(self):
		# Pastikan Source Website tersedia jika divalidasi oleh Job Applicant
		if not frappe.db.exists("Job Applicant Source", "Website"):
			frappe.get_doc({"doctype": "Job Applicant Source", "source_name": "Website"}).insert(ignore_permissions=True)

		# Buat user penguji untuk pengujian izin akses
		self._setup_test_users()

		# Buat Job Applicant uji
		self.applicant = frappe.new_doc("Job Applicant")
		self.applicant.applicant_name = "Kandidat Uji BGC"
		self.applicant.email_id = "kandidat.uji.bgc@example.com"
		self.applicant.phone_number = "08123456789"
		self.applicant.screening_status = "Done"
		self.applicant.recruitment_stage = "Screening"
		self.applicant.insert(ignore_permissions=True)

		# Jalankan pengujian sebagai HR Manager sesuai Spesifikasi 8
		frappe.set_user("test_hr_manager@example.com")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def _setup_test_users(self):
		# User Officer
		if not frappe.db.exists("User", "test_officer@example.com"):
			user = frappe.new_doc("User")
			user.email = "test_officer@example.com"
			user.first_name = "Test Officer"
			user.append("roles", {"role": "Background Check Officer"})
			user.flags.no_welcome_mail = True
			user.insert(ignore_permissions=True)
		else:
			u = frappe.get_doc("User", "test_officer@example.com")
			if not any(r.role == "Background Check Officer" for r in u.roles):
				u.append("roles", {"role": "Background Check Officer"})
				u.save(ignore_permissions=True)

		# User HR Manager
		if not frappe.db.exists("User", "test_hr_manager@example.com"):
			user = frappe.new_doc("User")
			user.email = "test_hr_manager@example.com"
			user.first_name = "Test HR Manager"
			user.append("roles", {"role": "HR Manager"})
			user.flags.no_welcome_mail = True
			user.insert(ignore_permissions=True)
		else:
			u = frappe.get_doc("User", "test_hr_manager@example.com")
			if not any(r.role == "HR Manager" for r in u.roles):
				u.append("roles", {"role": "HR Manager"})
				u.save(ignore_permissions=True)

		# User System Manager (Spesifikasi 8: dilarang membaca/menulis BGC & Finding)
		if not frappe.db.exists("User", "test_sys_manager@example.com"):
			user = frappe.new_doc("User")
			user.email = "test_sys_manager@example.com"
			user.first_name = "Test System Manager"
			user.append("roles", {"role": "System Manager"})
			user.flags.no_welcome_mail = True
			user.insert(ignore_permissions=True)
		else:
			u = frappe.get_doc("User", "test_sys_manager@example.com")
			if not any(r.role == "System Manager" for r in u.roles):
				u.append("roles", {"role": "System Manager"})
				u.save(ignore_permissions=True)

	def test_initiate_blocked_if_screening_not_done(self):
		"""Memulai BGC wajib ditolak jika screening_status bukan 'Done'."""
		self.applicant.screening_status = "Queued"
		self.applicant.save(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			initiate_background_check(self.applicant.name)

	def test_initiate_success_and_token_generation(self):
		"""Memulai BGC sukses: stage berpindah, token dibuat dengan kedaluwarsa 7 hari."""
		res = initiate_background_check(self.applicant.name)
		self.assertTrue(res.get("token"))

		self.applicant.reload()
		self.assertEqual(self.applicant.recruitment_stage, "Background Check")
		self.assertEqual(self.applicant.background_check, res["name"])

		bgc = frappe.get_doc("Background Check", res["name"])
		self.assertEqual(bgc.consent_status, "Pending")
		self.assertEqual(bgc.status, "Waiting Consent")
		self.assertTrue(bgc.consent_token)
		self.assertTrue(bgc.consent_token_expires_at)
		self.assertGreater(bgc.consent_token_expires_at, now_datetime())

		# Verifikasi 6 cakupan default terisi (Platform, Article, File, Case history, Posts, Social Media)
		self.assertEqual(len(bgc.consent_scope), 6)

	def test_consent_token_expiration(self):
		"""Token yang kedaluwarsa wajib ditolak saat pengiriman persetujuan."""
		res = initiate_background_check(self.applicant.name)
		token = res["token"]

		bgc = frappe.get_doc("Background Check", res["name"])
		# Simulasikan kedaluwarsa
		bgc.consent_token_expires_at = now_datetime() - timedelta(days=1)
		bgc.save(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError):
			submit_candidate_consent(
				token=token,
				granted_sources=["Platform", "Article"],
			)

	def test_consent_submission_and_queueing(self):
		"""Pengiriman persetujuan kandidat: status menjadi Granted, token dihanguskan."""
		res = initiate_background_check(self.applicant.name)
		token = res["token"]

		accounts = [{"platform": "GitHub", "username": "kandidat-uji"}]
		submit_res = submit_candidate_consent(
			token=token,
			granted_sources=["Platform", "Article", "Posts"],
			accounts=accounts,
		)
		self.assertTrue(submit_res.get("success"))

		bgc = frappe.get_doc("Background Check", res["name"])
		self.assertEqual(bgc.consent_status, "Granted")
		self.assertEqual(bgc.status, "Queued")
		self.assertIsNone(bgc.consent_token)  # Token sekali pakai dihanguskan
		self.assertTrue(bgc.consent_at)

		# Periksa akun media sosial kandidat tercatat
		self.assertEqual(len(bgc.accounts), 1)
		self.assertEqual(bgc.accounts[0].platform, "GitHub")
		self.assertEqual(bgc.accounts[0].username, "kandidat-uji")

		# Token yang sama tidak dapat dipakai dua kali
		with self.assertRaises(frappe.ValidationError):
			submit_candidate_consent(
				token=token,
				granted_sources=["Platform"],
			)

	def test_uploaded_document_alternative_path(self):
		"""Jalur alternatif: HR mengunggah dokumen persetujuan bertanda tangan."""
		bgc = frappe.new_doc("Background Check")
		bgc.job_applicant = self.applicant.name
		bgc.full_name = self.applicant.applicant_name
		bgc.consent_method = "Uploaded document"
		bgc.consent_file = "/files/signed_consent.pdf"
		bgc.insert(ignore_permissions=True)

		self.assertEqual(bgc.consent_status, "Granted")
		self.assertEqual(bgc.status, "Queued")
		self.assertEqual(bgc.consent_ip, "uploaded_by_hr")

	def test_revoke_consent_deletes_findings(self):
		"""Penarikan persetujuan wajib menghapus seluruh temuan mentah (Finding)."""
		res = initiate_background_check(self.applicant.name)
		bgc = frappe.get_doc("Background Check", res["name"])

		# Buat 2 temuan uji
		for i in range(2):
			frappe.get_doc({
				"doctype": "Background Check Finding",
				"background_check": bgc.name,
				"finding_type": "Article",
				"title": f"Temuan Uji {i}",
				"severity": "Info",
			}).insert(ignore_permissions=True)

		self.assertEqual(frappe.db.count("Background Check Finding", {"background_check": bgc.name}), 2)

		# Tarik persetujuan
		revoke_res = revoke_consent(bgc.name)
		self.assertEqual(revoke_res["findings_deleted"], 2)

		bgc.reload()
		self.assertEqual(bgc.consent_status, "Withdrawn")
		self.assertEqual(frappe.db.count("Background Check Finding", {"background_check": bgc.name}), 0)

	def test_permissions_officer_vs_interviewer(self):
		"""Spesifikasi 8: Hanya Background Check Officer & HR Manager yang dapat mengakses BGC & Finding. System Manager & Interviewer dilarang."""
		res = initiate_background_check(self.applicant.name)
		bgc_name = res["name"]

		finding = frappe.get_doc({
			"doctype": "Background Check Finding",
			"background_check": bgc_name,
			"finding_type": "Article",
			"title": "Temuan Uji Hak Akses",
			"severity": "Info",
		}).insert(ignore_permissions=True)

		# 1. Officer dapat membaca BGC dan Finding
		frappe.set_user("test_officer@example.com")
		self.assertTrue(frappe.has_permission("Background Check", "read", bgc_name))
		self.assertTrue(frappe.has_permission("Background Check Finding", "read", finding.name))

		# 2. HR Manager dapat membaca dan menulis BGC dan Finding
		frappe.set_user("test_hr_manager@example.com")
		self.assertTrue(frappe.has_permission("Background Check", "read", bgc_name))
		self.assertTrue(frappe.has_permission("Background Check Finding", "read", finding.name))
		self.assertTrue(frappe.has_permission("Background Check", "write", bgc_name))
		self.assertTrue(frappe.has_permission("Background Check Finding", "write", finding.name))

		# 3. Interviewer dilarang membaca BGC dan Finding
		frappe.set_user("test_interviewer@example.com")
		self.assertFalse(frappe.has_permission("Background Check", "read", bgc_name))
		self.assertFalse(frappe.has_permission("Background Check Finding", "read", finding.name))

		# 4. System Manager dilarang mengakses BGC dan Finding (Spesifikasi 8: isolasi privasi & UU PDP)
		frappe.set_user("test_sys_manager@example.com")
		self.assertFalse(frappe.has_permission("Background Check", "read", bgc_name))
		self.assertFalse(frappe.has_permission("Background Check Finding", "read", finding.name))
		self.assertFalse(frappe.has_permission("Background Check", "write", bgc_name))
		self.assertFalse(frappe.has_permission("Background Check Finding", "write", finding.name))
