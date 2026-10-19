# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Test komprehensif Fase 3b: Persetujuan kandidat untuk media sosial per akun dan isolasi jaringan."""

from __future__ import annotations

import json
import os
from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import now_datetime

from hris_ats.bgc.consent import initiate_background_check, revoke_consent, submit_candidate_consent
from hris_ats.bgc.fetch import FetchResult
from hris_ats.bgc.runner import run_all_sources


class TestBackgroundCheckSocialConsent(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")
		# Pastikan pelamar uji tersedia
		self.applicant_name = "test.social.consent@example.com"
		if not frappe.db.exists("Job Applicant", self.applicant_name):
			app = frappe.get_doc({
				"doctype": "Job Applicant",
				"applicant_name": "Ronald Richard",
				"email_id": self.applicant_name,
				"phone_number": "+6281234567890",
				"status": "Open",
				"screening_status": "Done",
			}).insert(ignore_permissions=True)
			self.applicant = app
		else:
			self.applicant = frappe.get_doc("Job Applicant", self.applicant_name)
			self.applicant.screening_status = "Done"
			self.applicant.save()

		# Settings mock_provider dinonaktifkan untuk menguji logika live runner
		self.settings = frappe.get_doc("Background Check Settings")
		self._orig_mock = self.settings.mock_provider
		self._orig_blocked = self.settings.fetch_blocked_domains
		self._orig_ack = self.settings.fetch_risk_acknowledged

		# Buka LinkedIn dan Instagram agar bisa diambil saat berizin
		self.settings.mock_provider = 0
		self.settings.fetch_blocked_domains = "tiktok.com"
		self.settings.fetch_risk_acknowledged = 1
		self.settings.save()

	def tearDown(self):
		frappe.set_user("Administrator")
		self.settings.reload()
		self.settings.mock_provider = self._orig_mock
		self.settings.fetch_blocked_domains = self._orig_blocked
		self.settings.fetch_risk_acknowledged = self._orig_ack
		self.settings.save()
		frappe.db.rollback()

	def test_zero_network_requests_without_social_media_scope(self):
		"""1. Tanpa scope Social Media -> nol permintaan jaringan ke akun media sosial."""
		res = initiate_background_check(self.applicant.name)
		bgc_name = res["name"]
		token = res["token"]

		accounts = [
			{"platform": "LinkedIn", "username": "ronaldrichard", "social_consent": 1},
			{"platform": "Instagram", "username": "ronaldrichard", "social_consent": 1},
		]

		# Kandidat HANYA memberikan persetujuan Platform dan Case history (TANPA Social Media)
		submit_candidate_consent(
			token=token,
			granted_sources=["Platform", "Case history"],
			accounts=accounts,
		)

		network_calls = []

		def fake_fetch(url, *args, **kwargs):
			network_calls.append(url)
			return FetchResult(url=url, status=200, body="ok", mode_used="company", robots_ignored=False, from_cache=False)

		with patch("hris_ats.bgc.fetch.fetch", side_effect=fake_fetch):
			run_all_sources(bgc_name)

		# Verifikasi NOL panggilan jaringan untuk linkedin atau instagram
		social_calls = [url for url in network_calls if "linkedin.com" in url or "instagram.com" in url]
		self.assertEqual(len(social_calls), 0, f"Expected 0 social network calls, got: {social_calls}")

		bgc = frappe.get_doc("Background Check", bgc_name)
		sr_map = {sr.source: sr for sr in bgc.source_runs}
		self.assertIn("Social Media", sr_map)
		self.assertEqual(sr_map["Social Media"].status, "Skipped")

	def test_only_consented_account_fetched_other_account_skipped_with_zero_calls(self):
		"""2. Scope ada tapi akun A saja yang dicentang -> hanya A diambil, akun B dilewati (nol permintaan)."""
		res = initiate_background_check(self.applicant.name)
		bgc_name = res["name"]
		token = res["token"]

		# LinkedIn dicentang (social_consent = 1), Instagram TIDAK dicentang (social_consent = 0)
		accounts = [
			{"platform": "LinkedIn", "username": "ronaldrichard", "social_consent": 1},
			{"platform": "Instagram", "username": "ronaldrichard", "social_consent": 0},
		]

		submit_candidate_consent(
			token=token,
			granted_sources=["Social Media"],
			accounts=accounts,
		)

		network_calls = []

		def fake_fetch(url, *args, **kwargs):
			network_calls.append(url)
			fake_html = "<html><title>Ronald Richard on LinkedIn</title><body><h1>Ronald Richard</h1><p>Jakarta, Indonesia</p></body></html>"
			return FetchResult(url=url, status=200, body=fake_html, mode_used="company", robots_ignored=False, from_cache=False)

		with patch("hris_ats.bgc.fetch.fetch", side_effect=fake_fetch):
			run_all_sources(bgc_name)

		# LinkedIn diambil (1 panggilan jaringan)
		linkedin_calls = [url for url in network_calls if "linkedin.com" in url]
		self.assertEqual(len(linkedin_calls), 1)

		# Instagram dilewati sama sekali (NOL panggilan jaringan)
		instagram_calls = [url for url in network_calls if "instagram.com" in url]
		self.assertEqual(len(instagram_calls), 0, f"Expected 0 calls to instagram, got: {instagram_calls}")

		bgc = frappe.get_doc("Background Check", bgc_name)
		sr_map = {sr.source: sr for sr in bgc.source_runs}
		sm_run = sr_map["Social Media"]
		self.assertEqual(sm_run.status, "Done")
		self.assertEqual(sm_run.accounts_skipped, 1)

	def test_hr_added_account_not_confirmed_by_candidate_is_skipped(self):
		"""3. Akun tambahan HR yang tidak dikonfirmasi kandidat -> dilewati (nol panggilan)."""
		res = initiate_background_check(self.applicant.name)
		bgc = frappe.get_doc("Background Check", res["name"])

		# HR menambahkan akun Twitter/X sebelum kandidat mengisi formulir
		bgc.append("accounts", {
			"platform": "Twitter/X",
			"username": "ronald_hr_added",
			"declared_by": "HR",
			"social_consent": 0,
		})
		bgc.save()

		# Kandidat mengisi formulir persetujuan hanya mengonfirmasi LinkedIn
		submit_candidate_consent(
			token=res["token"],
			granted_sources=["Social Media"],
			accounts=[
				{"platform": "LinkedIn", "username": "ronaldrichard", "social_consent": 1},
			],
		)

		network_calls = []

		def fake_fetch(url, *args, **kwargs):
			network_calls.append(url)
			return FetchResult(url=url, status=200, body="<html><body>Profile</body></html>", mode_used="company", robots_ignored=False, from_cache=False)

		with patch("hris_ats.bgc.fetch.fetch", side_effect=fake_fetch):
			run_all_sources(bgc.name)

		# Akun Twitter/X HR tidak pernah dipanggil
		twitter_calls = [url for url in network_calls if "x.com" in url or "twitter.com" in url]
		self.assertEqual(len(twitter_calls), 0)

		bgc.reload()
		sr_map = {sr.source: sr for sr in bgc.source_runs}
		# 1 akun HR dilewati
		self.assertGreaterEqual(sr_map["Social Media"].accounts_skipped, 1)

	def test_uploaded_document_path_without_consent_file_rejected(self):
		"""4. Jalur dokumen: tanpa consent_file -> ditolak saat social_consent diisi atau consent Granted."""
		bgc = frappe.new_doc("Background Check")
		bgc.job_applicant = self.applicant.name
		bgc.full_name = self.applicant.applicant_name
		bgc.consent_method = "Uploaded document"
		bgc.consent_status = "Granted"
		bgc.consent_file = None  # Kosong

		# Tanpa consent_file, status Granted harus ditolak
		with self.assertRaises(frappe.ValidationError):
			bgc.insert(ignore_permissions=True)

		# Coba dengan per-akun social_consent = 1 tanpa consent_file
		bgc2 = frappe.new_doc("Background Check")
		bgc2.job_applicant = self.applicant.name
		bgc2.full_name = self.applicant.applicant_name
		bgc2.consent_method = "Uploaded document"
		bgc2.consent_status = "Pending"
		bgc2.consent_file = None
		bgc2.append("accounts", {
			"platform": "LinkedIn",
			"username": "ronald_doc",
			"social_consent": 1,
		})

		with self.assertRaises(frappe.ValidationError):
			bgc2.insert(ignore_permissions=True)

	def test_uploaded_document_path_with_consent_file_attestation(self):
		"""5. Jalur dokumen dengan consent_file: HR konfirmasi per akun mencatat attested_by dan attested_on."""
		bgc = frappe.new_doc("Background Check")
		bgc.job_applicant = self.applicant.name
		bgc.full_name = self.applicant.applicant_name
		bgc.consent_method = "Uploaded document"
		bgc.consent_file = "/files/signed_candidate_consent.pdf"
		bgc.append("accounts", {
			"platform": "LinkedIn",
			"username": "ronald_doc_attested",
			"social_consent": 1,
		})
		bgc.insert(ignore_permissions=True)

		self.assertEqual(bgc.consent_status, "Granted")
		acc = bgc.accounts[0]
		self.assertEqual(acc.social_consent, 1)
		self.assertEqual(acc.social_consent_attested_by, "Administrator")
		self.assertIsNotNone(acc.social_consent_attested_on)

	def test_consent_revocation_clears_derived_data_crawldir_and_cache(self):
		"""6. Penarikan persetujuan menghapus semua data turunan akun media sosial, folder crawl, dan cache Redis."""
		res = initiate_background_check(self.applicant.name)
		bgc = frappe.get_doc("Background Check", res["name"])
		bgc.consent_status = "Granted"
		bgc.status = "Done"

		# Simulasikan data turunan pada akun
		bgc.accounts = []
		bgc.append("accounts", {
			"platform": "LinkedIn",
			"username": "ronaldrichard",
			"profile_url": "https://www.linkedin.com/in/ronaldrichard",
			"display_name": "Ronald Richard",
			"bio_snippet": "Senior Software Architect",
			"profile_location": "Jakarta, Indonesia",
			"identity_match": 85,
			"identity_reasons": "Name matched; City matched",
			"social_consent": 1,
		})
		bgc.save(ignore_permissions=True)

		# Buat dummy temuan Finding
		frappe.get_doc({
			"doctype": "Background Check Finding",
			"background_check": bgc.name,
			"finding_type": "Post",
			"title": "Post Finding",
			"severity": "Medium",
		}).insert(ignore_permissions=True)

		# Simulasikan folder crawl
		from hris_ats.bgc.providers.court_ma import get_crawldir
		crawldir = get_crawldir(bgc.name)
		os.makedirs(crawldir, exist_ok=True)
		dummy_file = os.path.join(crawldir, "crawl_page.html")
		with open(dummy_file, "w") as f:
			f.write("test")

		# Simulasikan cache Redis
		if hasattr(frappe, "cache") and frappe.cache:
			cache_key = "hris_ats:fetch_cache:company:GET:https://www.linkedin.com/in/ronaldrichard"
			frappe.cache.set_value(cache_key, {"body": "cached content"})

		self.assertTrue(os.path.exists(crawldir))

		# Tarik persetujuan
		revoke_consent(bgc.name)

		bgc.reload()
		self.assertEqual(bgc.consent_status, "Withdrawn")
		self.assertEqual(frappe.db.count("Background Check Finding", {"background_check": bgc.name}), 0)

		# Data turunan akun harus bersih
		acc = bgc.accounts[0]
		self.assertEqual(acc.display_name or "", "")
		self.assertEqual(acc.bio_snippet or "", "")
		self.assertEqual(acc.profile_location or "", "")
		self.assertIn(acc.identity_match, (None, 0))
		self.assertEqual(acc.social_consent, 0)

		# Crawldir harus terhapus
		self.assertFalse(os.path.exists(crawldir))

		# Cache Redis harus terhapus
		if hasattr(frappe, "cache") and frappe.cache:
			cached = frappe.cache.get_value("hris_ats:fetch_cache:company:GET:https://www.linkedin.com/in/ronaldrichard")
			self.assertIsNone(cached)
