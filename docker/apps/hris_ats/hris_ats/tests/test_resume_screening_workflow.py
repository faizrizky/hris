# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import os
import shutil

import frappe
from frappe.tests.utils import FrappeTestCase

from hris_ats.scoring.workflow import (
	bulk_rescreen,
	get_template_for_job,
	process_resume_screening,
	rescreen,
)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


class TestResumeScreeningWorkflow(FrappeTestCase):
	def setUp(self):
		# Pastikan settings aktif
		settings = frappe.get_single("Resume Screening Settings")
		settings.enabled = 1
		settings.auto_screen = 1
		settings.metric_pass_threshold = 60
		settings.save()

		# Buat Designation uji
		if not frappe.db.exists("Designation", "Test ATS Engineer"):
			frappe.get_doc({
				"doctype": "Designation",
				"designation_name": "Test ATS Engineer"
			}).insert(ignore_permissions=True)

		# Buat Template uji aktif
		if not frappe.db.exists("Resume Screening Template", "Test ATS Template"):
			t = frappe.new_doc("Resume Screening Template")
			t.template_name = "Test ATS Template"
			t.enabled = 1
			t.append("job_roles", {"designation": "Test ATS Engineer"})
			t.insert(ignore_permissions=True)

		# Buat Job Opening uji
		from hris_ats.tests import ensure_test_company
		company = ensure_test_company()
		jo = frappe.db.get_value("Job Opening", {"job_title": "Test ATS Opening"}, "name")
		if not jo:
			new_jo = frappe.get_doc({
				"doctype": "Job Opening",
				"job_title": "Test ATS Opening",
				"designation": "Test ATS Engineer",
				"company": company,
				"status": "Open",
				"min_education": "D4/S1",
				"education_majors": "Teknik Informatika",
				"min_years_experience": 2.0,
				"relevant_titles": "Software Engineer, Developer",
				"required_skills": "Python\nSQL\nERPNext",
			}).insert(ignore_permissions=True)
			self.job_opening = new_jo.name
		else:
			self.job_opening = jo

		# Jalankan pengujian sebagai HR Manager sesuai Spesifikasi 8
		from hris_ats.tests import ensure_test_hr_user
		self.hr_user = ensure_test_hr_user("hr.test@example.com")
		frappe.set_user(self.hr_user)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def _copy_cv_to_public_files(self, filename: str) -> str:
		"""Menyalin fixture CV ke direktori files Frappe agar dapat diakses via URL."""
		src_path = os.path.join(FIXTURES_DIR, filename)
		files_dir = frappe.get_site_path("public", "files")
		os.makedirs(files_dir, exist_ok=True)
		dst_path = os.path.join(files_dir, filename)
		shutil.copyfile(src_path, dst_path)
		return f"/files/{filename}"

	def test_job_applicant_screening_flow(self):
		"""Uji alur lengkap: pendaftaran pelamar -> screening diproses -> stage berubah ke 'Screening'."""
		file_url = self._copy_cv_to_public_files("cv_01_single_column.pdf")

		applicant = frappe.new_doc("Job Applicant")
		applicant.applicant_name = "Budi Santoso Uji"
		applicant.email_id = "budi.santoso.uji@example.com"
		applicant.job_title = self.job_opening
		applicant.resume_attachment = file_url
		applicant.insert(ignore_permissions=True)

		# Verifikasi dokumen screening terbentuk
		screening_name = frappe.db.get_value("Resume Screening", {"job_applicant": applicant.name}, "name")
		self.assertTrue(screening_name)

		# Jalankan proses screening secara sinkron
		process_resume_screening(screening_name)

		screening = frappe.get_doc("Resume Screening", screening_name)
		self.assertEqual(screening.status, "Done")
		self.assertGreater(screening.total_score, 70.0)
		self.assertEqual(screening.experience_level, "Experienced")
		self.assertEqual(len(screening.results), 9)

		# Periksa sinkronisasi ke Job Applicant
		applicant.reload()
		self.assertEqual(applicant.resume_screening, screening.name)
		self.assertEqual(applicant.resume_score, screening.total_score)
		self.assertEqual(applicant.screening_status, "Done")
		self.assertEqual(applicant.recruitment_stage, "Screening")

	def test_template_selection_priority(self):
		"""Prioritas pemilihan template: template kustom lowongan -> template jabatan -> gagal jika tidak ada."""
		# Buat template kedua
		if not frappe.db.exists("Resume Screening Template", "Custom Specific Template"):
			t = frappe.new_doc("Resume Screening Template")
			t.template_name = "Custom Specific Template"
			t.enabled = 1
			t.insert(ignore_permissions=True)

		# Job Opening dengan explicit screening_template
		jo = frappe.get_doc("Job Opening", self.job_opening)
		jo.screening_template = "Custom Specific Template"
		jo.save(ignore_permissions=True)

		selected = get_template_for_job(self.job_opening)
		self.assertEqual(selected, "Custom Specific Template")

		# Fallback ke designation template jika screening_template kosong
		jo.screening_template = None
		jo.save(ignore_permissions=True)
		fallback = get_template_for_job(self.job_opening)
		self.assertEqual(fallback, "Test ATS Template")


	def test_rescreen_and_bulk_rescreen(self):
		"""Aksi screen ulang dan aksi massal berfungsi menjadwalkan screening."""
		file_url = self._copy_cv_to_public_files("cv_01_single_column.pdf")
		applicant = frappe.new_doc("Job Applicant")
		applicant.applicant_name = "Rescreen Applicant"
		applicant.email_id = "rescreen@example.com"
		applicant.job_title = self.job_opening
		applicant.resume_attachment = file_url
		applicant.insert(ignore_permissions=True)

		screening_name = frappe.db.get_value("Resume Screening", {"job_applicant": applicant.name}, "name")
		self.assertTrue(screening_name)

		# Aksi rescreen tunggal
		res_single = rescreen(screening_name)
		self.assertEqual(res_single["status"], "Queued")

		# Aksi bulk rescreen
		res_bulk = bulk_rescreen([applicant.name])
		self.assertEqual(res_bulk["count"], 1)

	def test_workflow_typing_and_any_runtime_resolution(self):
		"""Regression test: Ensure Any is properly defined so typing.get_type_hints succeeds without NameError."""
		import typing

		from hris_ats.scoring import workflow

		hints_rescreen = typing.get_type_hints(workflow.rescreen)
		self.assertIn("return", hints_rescreen)

		hints_bulk = typing.get_type_hints(workflow.bulk_rescreen)
		self.assertIn("return", hints_bulk)

		hints_app = typing.get_type_hints(workflow.rescreen_applicant)
		self.assertIn("return", hints_app)
