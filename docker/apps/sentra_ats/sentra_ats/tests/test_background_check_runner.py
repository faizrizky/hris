# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from sentra_ats.bgc.consent import initiate_background_check, submit_candidate_consent
from sentra_ats.bgc.runner import run_all_sources


class TestBackgroundCheckRunner(FrappeTestCase):
	def setUp(self):
		if not frappe.db.exists("Job Applicant Source", "Website"):
			frappe.get_doc({"doctype": "Job Applicant Source", "source_name": "Website"}).insert(ignore_permissions=True)

		# Buat Designation jika belum ada
		if not frappe.db.exists("Designation", "UI/UX Designer"):
			frappe.get_doc({"doctype": "Designation", "designation_name": "UI/UX Designer"}).insert(ignore_permissions=True)

		# Buat Job Opening uji
		from sentra_ats.tests import ensure_test_company
		company = ensure_test_company()
		jo_name = frappe.db.get_value("Job Opening", {"job_title": "Lead UI/UX Designer"}, "name")
		if not jo_name:
			jo = frappe.get_doc({
				"doctype": "Job Opening",
				"job_title": "Lead UI/UX Designer",
				"designation": "UI/UX Designer",
				"company": company,
				"status": "Open",
				"required_skills": "Figma\nUI/UX\nDesign System",
				"preferred_skills": "React\nTypeScript",
			}).insert(ignore_permissions=True)
			self.job_opening = jo.name
		else:
			self.job_opening = jo_name

		# Buat Job Applicant Ronald Richard
		self.applicant = frappe.new_doc("Job Applicant")
		self.applicant.applicant_name = "Ronald Richard"
		self.applicant.email_id = "ronald.richard@example.com"
		self.applicant.job_title = self.job_opening
		self.applicant.screening_status = "Done"
		self.applicant.city = "Jakarta"
		self.applicant.insert(ignore_permissions=True)

		# Jalankan pengujian sebagai HR Manager / BGC Officer sesuai Spesifikasi 8
		from sentra_ats.tests import ensure_test_hr_user
		self.hr_user = ensure_test_hr_user("hr.test@example.com")
		frappe.set_user(self.hr_user)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_runner_aborts_without_granted_consent(self):
		"""Runner dilarang memproses sumber apa pun jika consent_status bukan 'Granted'."""
		res = initiate_background_check(self.applicant.name)
		bgc_name = res["name"]

		# Panggil runner saat status masih Pending
		run_all_sources(bgc_name)

		bgc = frappe.get_doc("Background Check", bgc_name)
		self.assertEqual(bgc.consent_status, "Pending")
		self.assertEqual(bgc.status, "Waiting Consent")
		# Tidak ada temuan yang dibuat
		self.assertEqual(frappe.db.count("Background Check Finding", {"background_check": bgc_name}), 0)

	def test_runner_end_to_end_with_mock_provider(self):
		"""Pengujian runner ujung-ke-ujung dengan mock provider:
		Semua tab menghasilkan temuan yang sesuai spesifikasi,
		permohonan perdata ber-severity Info, tingkat risiko otomatis Rendah, dan ringkasan terbentuk.
		"""
		res = initiate_background_check(self.applicant.name)
		bgc_name = res["name"]
		token = res["token"]

		# Kandidat memberikan persetujuan untuk 6 sumber (termasuk Social Media)
		accounts = [
			{"platform": "GitHub", "username": "ronaldrichard"},
			{"platform": "LinkedIn", "username": "ronaldrichard", "social_consent": 1},
			{"platform": "Instagram", "username": "ronaldrichard", "social_consent": 1},
		]
		submit_candidate_consent(
			token=token,
			granted_sources=["Platform", "Article", "File", "Case history", "Posts", "Social Media"],
			accounts=accounts,
		)

		# Jalankan proses pengumpulan dan analisis data secara sinkron
		run_all_sources(bgc_name)

		bgc = frappe.get_doc("Background Check", bgc_name)
		self.assertEqual(bgc.status, "Done")

		# 1. Periksa akun publik
		self.assertEqual(len(bgc.accounts), 3)
		for acc in bgc.accounts:
			self.assertTrue(acc.profile_url)
			self.assertEqual(acc.exists, 1)
			if acc.platform in ("Instagram", "LinkedIn"):
				# Domain terlarang tidak pernah di-scrape: display_name kosong & identity_match tidak dihitung
				self.assertIn(acc.identity_match, (None, 0))
				self.assertEqual(acc.display_name or "", "")
			else:
				self.assertGreaterEqual(acc.identity_match, 50)
				self.assertTrue(acc.display_name)

		# 2. Periksa status per sumber (source_runs)
		for sr in bgc.source_runs:
			self.assertEqual(sr.status, "Done", f"Source {sr.source} status is {sr.status}, error: {sr.error}")
			self.assertGreaterEqual(sr.items_found, 1)

		# 3. Periksa temuan di semua tipe
		articles = frappe.get_all("Background Check Finding", filters={"background_check": bgc.name, "finding_type": "Article"}, fields=["title", "category", "severity", "match_confidence", "text_source", "evidence_excerpt"])
		self.assertGreaterEqual(len(articles), 1)
		self.assertTrue(any(a.category == "Achievement" and a.severity == "Info" for a in articles))
		self.assertTrue(articles[0].text_source)

		files = frappe.get_all("Background Check Finding", filters={"background_check": bgc.name, "finding_type": "File"}, fields=["title", "file_type", "match_confidence"])
		self.assertGreaterEqual(len(files), 1)

		cases = frappe.get_all("Background Check Finding", filters={"background_check": bgc.name, "finding_type": "Case"}, fields=["case_type", "party_role", "severity", "text_source", "evidence_excerpt", "detail_url"])
		self.assertGreaterEqual(len(cases), 1)
		# Permohonan perdata 72/PDT.P/2017 wajib ber-severity Info dan party_role Pemohon
		self.assertEqual(cases[0].party_role, "Pemohon")
		self.assertEqual(cases[0].severity, "Info")
		self.assertTrue(cases[0].text_source)
		self.assertTrue(cases[0].evidence_excerpt)

		# 4. Periksa hasil evaluasi tingkat risiko dan ringkasan
		self.assertEqual(bgc.risk_level_auto, "Low")
		self.assertTrue(bgc.summary_auto)
		self.assertIn("Ronald Richard", bgc.summary_auto)
		self.assertIn("UI/UX Designer", bgc.summary_auto)
		self.assertIn("achievement", bgc.summary_auto.lower())
		# Perkara Info tidak masuk hitungan risiko
		self.assertIn("case record", bgc.summary_auto.lower())

	def test_runner_live_mode_with_mocked_network(self):
		"""Pengujian runner saat mock_provider = 0:
		Platform dan Case history berjalan live lewat fetch.py (jaringan di-mock),
		Article, File, dan Posts menjadi Skipped dengan alasan yang jelas,
		dan fetch_mode_used serta robots_ignored_count tercatat pada source_runs.
		"""
		import os
		from unittest.mock import patch

		from scrapling.parser import Adaptor

		from sentra_ats.bgc.fetch import FetchResult

		# 1. Pastikan mock_provider = 0 di Settings
		settings = frappe.get_doc("Background Check Settings")
		old_mock = settings.mock_provider
		settings.mock_provider = 0
		settings.save()

		try:
			res = initiate_background_check(self.applicant.name)
			bgc_name = res["name"]
			token = res["token"]

			accounts = [
				{"platform": "GitHub", "username": "ronaldrichard"},
				{"platform": "LinkedIn", "username": "ronaldrichard"},
				{"platform": "Instagram", "username": "ronaldrichard"},
			]
			submit_candidate_consent(
				token=token,
				granted_sources=["Platform", "Article", "File", "Case history", "Posts"],
				accounts=accounts,
			)

			fixtures_dir = os.path.join(
				os.path.dirname(__file__),
				"fixtures",
				"court_ma",
			)
			with open(os.path.join(fixtures_dir, "search_page_1.html"), encoding="utf-8") as f:
				search_html = f.read()
			with open(os.path.join(fixtures_dir, "detail_case_1.html"), encoding="utf-8") as f:
				detail_html = f.read()

			def fake_fetch(url, *args, **kwargs):
				if "github.com" in url:
					return FetchResult(
						url=url,
						status=200,
						body="github profile",
						mode_used="company+robots",
						robots_ignored=False,
						from_cache=False,
					)
				elif "pencarian" in url:
					return FetchResult(
						url=url,
						status=200,
						body=search_html,
						mode_used="company+robots",
						robots_ignored=False,
						from_cache=False,
						page=Adaptor(search_html),
					)
				elif "putusan" in url:
					return FetchResult(
						url=url,
						status=200,
						body=detail_html,
						mode_used="company+robots",
						robots_ignored=False,
						from_cache=False,
						page=Adaptor(detail_html),
					)
				return FetchResult(url=url, status=404, body="", mode_used="company+robots", robots_ignored=False, from_cache=False)

			with patch("sentra_ats.bgc.fetch.fetch", side_effect=fake_fetch):
				run_all_sources(bgc_name)

			bgc = frappe.get_doc("Background Check", bgc_name)
			self.assertEqual(bgc.status, "Done")

			# Periksa source_runs
			runs_by_source = {sr.source: sr for sr in bgc.source_runs}

			# Platform -> Done
			p_run = runs_by_source["Platform"]
			self.assertEqual(p_run.status, "Done")
			self.assertIn("company+robots", p_run.fetch_mode_used)

			# Case history -> Done
			c_run = runs_by_source["Case history"]
			self.assertEqual(c_run.status, "Done")
			self.assertEqual(c_run.fetch_mode_used, "company+robots")
			self.assertGreaterEqual(c_run.items_found, 1)

			live_cases = frappe.get_all(
				"Background Check Finding",
				filters={"background_check": bgc.name, "finding_type": "Case"},
				fields=["case_type", "party_role", "text_source", "evidence_excerpt", "detail_url"],
			)
			self.assertGreaterEqual(len(live_cases), 1)
			self.assertTrue(live_cases[0].text_source)
			self.assertTrue(live_cases[0].evidence_excerpt)

			# Article -> Skipped
			a_run = runs_by_source["Article"]
			self.assertEqual(a_run.status, "Skipped")
			self.assertIn("Search provider not configured", a_run.error)

			# File -> Skipped
			f_run = runs_by_source["File"]
			self.assertEqual(f_run.status, "Skipped")
			self.assertIn("Search provider not configured", f_run.error)

			# Posts -> Skipped
			post_run = runs_by_source["Posts"]
			self.assertEqual(post_run.status, "Skipped")
			self.assertIn("Social media API credentials not configured", post_run.error)

		finally:
			settings.reload()
			settings.mock_provider = old_mock
			settings.save()

	def test_runner_live_mode_fails_closed_when_redis_unavailable(self):
		"""Pengujian fail-closed: pada mode live tanpa Redis, runner menandai sumber Failed dengan error_template 'Redis not available'."""
		from unittest.mock import patch
		res = initiate_background_check(self.applicant.name)
		bgc_name = res["name"]
		token = res["token"]
		submit_candidate_consent(token=token, granted_sources=["Platform", "Case history"])

		settings = frappe.get_single("Background Check Settings")
		old_mock = settings.mock_provider
		settings.mock_provider = 0
		settings.save()

		try:
			# Simulasikan Redis tidak tersedia pada mode live
			with patch("sentra_ats.bgc.runner.is_redis_available", return_value=False):
				old_in_test = getattr(frappe.flags, "in_test", False)
				frappe.flags.in_test = False
				try:
					run_all_sources(bgc_name)
				finally:
					frappe.flags.in_test = old_in_test

			bgc = frappe.get_doc("Background Check", bgc_name)
			for sr in bgc.source_runs:
				if sr.source in ["Platform", "Case history"]:
					self.assertEqual(sr.status, "Failed")
					self.assertIn("Redis not available", sr.error_template)
					self.assertEqual(sr.error_params, "{}")
		finally:
			settings.reload()
			settings.mock_provider = old_mock
			settings.save()

