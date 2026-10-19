# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Test integrasi Frappe untuk ekspor data kandidat (Spesifikasi 5.3 & Fase 4).
Hanya dijalankan pada site uji yang berawalan ats-test*.
"""

from __future__ import annotations

import base64
import os

import frappe
from frappe.tests.utils import FrappeTestCase

from hris_ats.bgc.consent import initiate_background_check, revoke_consent, submit_candidate_consent
from hris_ats.bgc.export_processor import process_candidate_export_data, upload_candidate_export
from hris_ats.tests import ensure_test_encryption_key, ensure_test_hr_user

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "export")


class TestBackgroundCheckExport(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		ensure_test_encryption_key()

		self.applicant_name = "test.export.applicant@example.com"
		if not frappe.db.exists("Job Applicant", self.applicant_name):
			self.applicant = frappe.get_doc({
				"doctype": "Job Applicant",
				"applicant_name": "Bagus Pratama",
				"email_id": self.applicant_name,
				"phone_number": "+6281234567891",
				"status": "Open",
				"screening_status": "Done",
			}).insert(ignore_permissions=True)
		else:
			self.applicant = frappe.get_doc("Job Applicant", self.applicant_name)
			self.applicant.screening_status = "Done"
			self.applicant.save()

		self.settings = frappe.get_doc("Background Check Settings")
		self._orig_mock = self.settings.mock_provider
		self._orig_blocked = self.settings.fetch_blocked_domains
		self._orig_ack = self.settings.fetch_risk_acknowledged

		self.settings.mock_provider = 0
		self.settings.fetch_blocked_domains = ""
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save()

		self.hr_user = ensure_test_hr_user("hr.test@example.com")
		frappe.set_user(self.hr_user)

	def tearDown(self):
		frappe.set_user("Administrator")
		self.settings.reload()
		self.settings.mock_provider = self._orig_mock
		self.settings.fetch_blocked_domains = self._orig_blocked
		self.settings.fetch_risk_acknowledged = self._orig_ack
		self.settings.save()
		frappe.db.rollback()

	def test_upload_candidate_export_success(self):
		"""1. Pengunggahan arsip ekspor resmi menghasilkan Finding Post & Comment dengan provenance Candidate export."""
		init_res = initiate_background_check(self.applicant.name)
		bgc_name = init_res["name"]
		token = init_res["token"]

		zip_path = os.path.join(FIXTURE_DIR, "instagram_export.zip")
		with open(zip_path, "rb") as f:
			zip_bytes = f.read()

		# Unggah lewat endpoint upload_candidate_export
		frappe.form_dict["file_content_base64"] = base64.b64encode(zip_bytes).decode("utf-8")
		res = upload_candidate_export(
			token=token,
			platform="Instagram",
			username="baguspratama",
		)
		assert res["result"]["status"] == "Success"

		bgc = frappe.get_doc("Background Check", bgc_name)
		# Akun berstatus Data export
		acc = None
		for a in bgc.accounts:
			if a.platform == "Instagram" and a.username == "baguspratama":
				acc = a
				break
		assert acc is not None
		assert acc.connection_method == "Data export"
		assert acc.exists == 1
		assert acc.display_name == "Bagus Pratama"

		# Finding Post dan Comment
		findings = frappe.get_all(
			"Background Check Finding",
			filters={"background_check": bgc_name},
			fields=["name", "finding_type", "snippet", "provenance", "text_source", "category", "severity"],
		)
		assert len(findings) >= 2
		post_findings = [f for f in findings if f.finding_type == "Post"]
		comment_findings = [f for f in findings if f.finding_type == "Comment"]

		assert len(post_findings) == 2
		assert len(comment_findings) == 1

		for f in findings:
			assert f.provenance == "Candidate export"
			assert f.text_source == "Candidate export"
			assert "@alex.dev" not in f.snippet
			assert "@sarah" not in f.snippet
			assert "@partner" not in f.snippet

	def test_submit_candidate_consent_with_export_base64(self):
		"""2. Pengunggahan data ekspor langsung pada saat submit formulir persetujuan."""
		init_res = initiate_background_check(self.applicant.name)
		bgc_name = init_res["name"]
		token = init_res["token"]

		zip_path = os.path.join(FIXTURE_DIR, "facebook_export.zip")
		with open(zip_path, "rb") as f:
			fb_b64 = base64.b64encode(f.read()).decode("utf-8")

		accounts_payload = [
			{
				"platform": "Facebook",
				"username": "baguspratama",
				"social_consent": 1,
				"export_base64": fb_b64,
				"export_filename": "facebook_export.zip",
			}
		]

		res = submit_candidate_consent(
			token=token,
			granted_sources=["Social Media"],
			accounts=accounts_payload,
			consent_language="id",
		)
		assert res["success"] is True

		bgc = frappe.get_doc("Background Check", bgc_name)
		assert bgc.consent_status == "Granted"

		findings = frappe.get_all(
			"Background Check Finding",
			filters={"background_check": bgc_name},
			fields=["name", "finding_type", "snippet", "provenance"],
		)
		assert len(findings) == 2  # 1 post, 1 comment
		assert all(f.provenance == "Candidate export" for f in findings)

	def test_export_security_rejections(self):
		"""3. Arsip berbahaya (zip-slip) ditolak dan melempar Exception keamanan."""
		init_res = initiate_background_check(self.applicant.name)
		bgc_name = init_res["name"]

		bgc = frappe.get_doc("Background Check", bgc_name)
		bgc.consent_status = "Granted"
		bgc.append("consent_scope", {"source": "Social Media", "granted": 1})
		bgc.append("accounts", {
			"platform": "Instagram",
			"username": "baguspratama",
			"social_consent": 1,
		})
		bgc.save(ignore_permissions=True)

		zip_slip_path = os.path.join(FIXTURE_DIR, "zip_slip.zip")
		with open(zip_slip_path, "rb") as f:
			slip_bytes = f.read()

		# Harus melempar frappe.ValidationError / ZipSlipError
		with self.assertRaises(frappe.ValidationError):
			process_candidate_export_data(
				bgc_name=bgc.name,
				platform="Instagram",
				username="baguspratama",
				archive_bytes=slip_bytes,
			)

	def test_revocation_deletes_all_export_findings(self):
		"""4. Penarikan persetujuan menghapus seluruh temuan ekspor sesuai kepatuhan PDP."""
		init_res = initiate_background_check(self.applicant.name)
		bgc_name = init_res["name"]
		token = init_res["token"]

		zip_path = os.path.join(FIXTURE_DIR, "linkedin_export.zip")
		with open(zip_path, "rb") as f:
			zip_bytes = f.read()

		frappe.form_dict["file_content_base64"] = base64.b64encode(zip_bytes).decode("utf-8")
		upload_candidate_export(
			token=token,
			platform="LinkedIn",
			username="baguspratama",
		)

		count_before = frappe.db.count("Background Check Finding", {"background_check": bgc_name})
		assert count_before > 0

		# Tarik persetujuan
		rev_res = revoke_consent(bgc_name)
		assert rev_res["findings_deleted"] == count_before

		count_after = frappe.db.count("Background Check Finding", {"background_check": bgc_name})
		assert count_after == 0
