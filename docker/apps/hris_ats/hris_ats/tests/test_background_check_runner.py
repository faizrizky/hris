# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from hris_ats.bgc.consent import initiate_background_check, submit_candidate_consent
from hris_ats.bgc.runner import run_all_sources


class TestBackgroundCheckRunner(FrappeTestCase):
	def setUp(self):
		if not frappe.db.exists("Job Applicant Source", "Website"):
			frappe.get_doc({"doctype": "Job Applicant Source", "source_name": "Website"}).insert(ignore_permissions=True)

		# Buat Designation jika belum ada
		if not frappe.db.exists("Designation", "UI/UX Designer"):
			frappe.get_doc({"doctype": "Designation", "designation_name": "UI/UX Designer"}).insert(ignore_permissions=True)

		# Buat Job Opening uji
		jo_name = frappe.db.get_value("Job Opening", {"job_title": "Lead UI/UX Designer"}, "name")
		if not jo_name:
			jo = frappe.get_doc({
				"doctype": "Job Opening",
				"job_title": "Lead UI/UX Designer",
				"designation": "UI/UX Designer",
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

	def tearDown(self):
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

		# Kandidat memberikan persetujuan untuk 5 sumber
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

		# Jalankan proses pengumpulan dan analisis data secara sinkron
		run_all_sources(bgc_name)

		bgc = frappe.get_doc("Background Check", bgc_name)
		self.assertEqual(bgc.status, "Done")

		# 1. Periksa akun publik
		self.assertEqual(len(bgc.accounts), 3)
		for acc in bgc.accounts:
			self.assertTrue(acc.profile_url)
			self.assertEqual(acc.exists, 1)

		# 2. Periksa status per sumber (source_runs)
		for sr in bgc.source_runs:
			self.assertEqual(sr.status, "Done")
			self.assertGreaterEqual(sr.items_found, 1)

		# 3. Periksa temuan di semua tipe
		articles = frappe.get_all("Background Check Finding", filters={"background_check": bgc.name, "finding_type": "Article"}, fields=["title", "category", "severity", "match_confidence"])
		self.assertGreaterEqual(len(articles), 1)
		self.assertTrue(any(a.category == "Prestasi" and a.severity == "Info" for a in articles))

		files = frappe.get_all("Background Check Finding", filters={"background_check": bgc.name, "finding_type": "File"}, fields=["title", "file_type", "match_confidence"])
		self.assertGreaterEqual(len(files), 1)

		cases = frappe.get_all("Background Check Finding", filters={"background_check": bgc.name, "finding_type": "Case"}, fields=["case_type", "party_role", "severity"])
		self.assertGreaterEqual(len(cases), 1)
		# Permohonan perdata 72/PDT.P/2017 wajib ber-severity Info dan party_role Pemohon
		self.assertEqual(cases[0].party_role, "Pemohon")
		self.assertEqual(cases[0].severity, "Info")

		# 4. Periksa hasil evaluasi tingkat risiko dan ringkasan
		self.assertEqual(bgc.risk_level_auto, "Rendah")
		self.assertTrue(bgc.summary_auto)
		self.assertIn("Ronald Richard", bgc.summary_auto)
		self.assertIn("UI/UX Designer", bgc.summary_auto)
		self.assertIn("prestasi", bgc.summary_auto)
		# Perkara Info tidak masuk hitungan risiko
		self.assertIn("catatan perkara", bgc.summary_auto)

	def test_runner_live_mode_with_mocked_network(self):
		"""Pengujian runner saat mock_provider = 0:
		Platform dan Case history berjalan live lewat fetch.py (jaringan di-mock),
		Article, File, dan Posts menjadi Skipped dengan alasan yang jelas,
		dan fetch_mode_used serta robots_ignored_count tercatat pada source_runs.
		"""
		import os
		from unittest.mock import patch
		from scrapling.parser import Adaptor
		from hris_ats.bgc.fetch import FetchResult

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
			with open(os.path.join(fixtures_dir, "search_page_1.html"), "r", encoding="utf-8") as f:
				search_html = f.read()
			with open(os.path.join(fixtures_dir, "detail_case_1.html"), "r", encoding="utf-8") as f:
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

			with patch("hris_ats.bgc.fetch.fetch", side_effect=fake_fetch):
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

			# Article -> Skipped
			a_run = runs_by_source["Article"]
			self.assertEqual(a_run.status, "Skipped")
			self.assertIn("Penyedia pencarian belum dikonfigurasi", a_run.error)

			# File -> Skipped
			f_run = runs_by_source["File"]
			self.assertEqual(f_run.status, "Skipped")
			self.assertIn("Penyedia pencarian belum dikonfigurasi", f_run.error)

			# Posts -> Skipped
			post_run = runs_by_source["Posts"]
			self.assertEqual(post_run.status, "Skipped")
			self.assertIn("Kredensial API media sosial belum dikonfigurasi", post_run.error)

		finally:
			settings.reload()
			settings.mock_provider = old_mock
			settings.save()

