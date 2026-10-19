# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from datetime import timedelta

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, getdate, nowdate

from hris_ats.bgc.consent import initiate_background_check, submit_candidate_consent
from hris_ats.tasks import daily_retention_purge


class TestBackgroundCheckPhase7(FrappeTestCase):
	def setUp(self):
		if not frappe.db.exists("Job Applicant Source", "Website"):
			frappe.get_doc({"doctype": "Job Applicant Source", "source_name": "Website"}).insert(ignore_permissions=True)

		if not frappe.db.exists("Designation", "QA Engineer"):
			frappe.get_doc({"doctype": "Designation", "designation_name": "QA Engineer"}).insert(ignore_permissions=True)

		if not frappe.db.exists("Skill", "Testing"):
			frappe.get_doc({"doctype": "Skill", "skill_name": "Testing"}).insert(ignore_permissions=True)

		if not frappe.db.exists("Interview Type", "Technical Interview"):
			it = frappe.new_doc("Interview Type")
			it.interview_type_name = "Technical Interview"
			it.append("expected_skill_set", {"skill": "Testing"})
			it.insert(ignore_permissions=True)

		# Job Opening
		jo_name = frappe.db.get_value("Job Opening", {"job_title": "QA Automation Lead"}, "name")
		if not jo_name:
			jo = frappe.get_doc({
				"doctype": "Job Opening",
				"job_title": "QA Automation Lead",
				"designation": "QA Engineer",
				"status": "Open",
			}).insert(ignore_permissions=True)
			self.job_opening = jo.name
		else:
			self.job_opening = jo_name

		# Pelamar uji
		self.applicant = frappe.new_doc("Job Applicant")
		self.applicant.applicant_name = "Pelamar Uji Wawancara"
		self.applicant.email_id = "pelamar.wawancara@example.com"
		self.applicant.job_title = self.job_opening
		self.applicant.screening_status = "Done"
		self.applicant.insert(ignore_permissions=True)

		# Jalankan pengujian sebagai HR Manager / BGC Officer sesuai Spesifikasi 8
		from hris_ats.tests import ensure_test_hr_user
		self.hr_user = ensure_test_hr_user("hr.test@example.com")
		frappe.set_user(self.hr_user)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()
		# Bersihkan pelamar uji dan BGC terkait agar database uji tidak tercemar
		for b in frappe.get_all("Background Check", filters={"full_name": "Pelamar Uji Wawancara"}, pluck="name"):
			frappe.db.delete("Background Check Finding", {"background_check": b})
			frappe.delete_doc("Background Check", b, force=1, ignore_permissions=True)
		for a in frappe.get_all("Job Applicant", filters={"email_id": "pelamar.wawancara@example.com"}, pluck="name"):
			frappe.delete_doc("Job Applicant", a, force=1, ignore_permissions=True)

	def test_interview_blocked_if_hr_conclusion_empty(self):
		"""Wawancara (Interview) wajib ditolak jika berkas BGC belum memiliki hr_conclusion."""
		init_res = initiate_background_check(self.applicant.name)
		bgc = frappe.get_doc("Background Check", init_res["name"])
		self.assertFalse(bgc.hr_conclusion)

		# Buat Interview
		interview = frappe.new_doc("Interview")
		interview.job_applicant = self.applicant.name
		interview.job_opening = self.job_opening
		interview.interview_type = "Technical Interview"
		interview.scheduled_on = nowdate()
		interview.from_time = "10:00:00"
		interview.to_time = "11:00:00"

		with self.assertRaises(frappe.ValidationError) as cm:
			interview.insert(ignore_permissions=True)
		self.assertIn("HR Conclusion (hr_conclusion)", str(cm.exception))

	def test_interview_allowed_when_hr_conclusion_filled(self):
		"""Wawancara dapat dibuat jika hr_conclusion telah diisi oleh HR."""
		init_res = initiate_background_check(self.applicant.name)
		bgc = frappe.get_doc("Background Check", init_res["name"])
		bgc.hr_conclusion = "Candidate has a clear record and is recommended."
		bgc.save(ignore_permissions=True)

		interview = frappe.new_doc("Interview")
		interview.job_applicant = self.applicant.name
		interview.job_opening = self.job_opening
		interview.interview_type = "Technical Interview"
		interview.scheduled_on = nowdate()
		interview.from_time = "10:00:00"
		interview.to_time = "11:00:00"
		interview.insert(ignore_permissions=True)

		self.assertTrue(interview.name)
		self.applicant.reload()
		self.assertEqual(self.applicant.recruitment_stage, "Interview")

	def test_daily_retention_purge_and_skck_expiry(self):
		"""Pengujian tugas retensi harian:
		1. SKCK kedaluwarsa diperbarui otomatis.
		2. BGC yang melewati purge_after: temuan mentah dibersihkan, is_purged diset 1, kesimpulan & consent dipertahankan.
		3. Eksekusi ulang bersifat idempoten (0 purged pada panggilan berikutnya).
		"""
		today = getdate(nowdate())
		past_date = add_days(today, -5)

		# Buat BGC dengan skck kedaluwarsa dan purge_after lampau
		init_res = initiate_background_check(self.applicant.name)
		bgc = frappe.get_doc("Background Check", init_res["name"])
		bgc.consent_status = "Granted"
		bgc.consent_method = "Uploaded document"
		bgc.consent_file = "/files/test_signed.pdf"
		bgc.skck_file = "/files/skck_test.pdf"
		bgc.skck_valid_until = past_date
		bgc.skck_status = "Clear"
		bgc.purge_after = past_date
		bgc.summary_auto = "Initial automated summary"
		bgc.hr_conclusion = "Permanent HR conclusion"
		bgc.risk_level_final = "Low"
		bgc.append("accounts", {"platform": "GitHub", "username": "pelamar_uji"})
		bgc.save(ignore_permissions=True)

		# Tambah temuan mentah
		frappe.get_doc({
			"doctype": "Background Check Finding",
			"background_check": bgc.name,
			"finding_type": "Article",
			"title": "Temuan Mentah Kedaluwarsa",
			"severity": "Info",
		}).insert(ignore_permissions=True)

		self.assertEqual(frappe.db.count("Background Check Finding", {"background_check": bgc.name}), 1)

		# Jalankan task retensi harian
		res = daily_retention_purge()
		self.assertGreaterEqual(res["bgcs_purged"], 1)
		self.assertGreaterEqual(res["findings_deleted"], 1)

		# Verifikasi dokumen setelah pembersihan
		bgc.reload()
		self.assertEqual(bgc.skck_status, "Expired")
		self.assertIsNone(bgc.summary_auto)
		self.assertEqual(len(bgc.accounts), 0)
		self.assertEqual(bgc.is_purged, 1)
		self.assertEqual(frappe.db.count("Background Check Finding", {"background_check": bgc.name}), 0)

		# Bukti persetujuan dan kesimpulan HR tetap utuh
		self.assertEqual(bgc.consent_status, "Granted")
		self.assertEqual(bgc.consent_method, "Uploaded document")
		self.assertEqual(bgc.hr_conclusion, "Permanent HR conclusion")
		self.assertEqual(bgc.risk_level_final, "Low")

		# Uji idempoten: eksekusi kedua tidak memproses ulang dokumen yang sudah dipurge
		res2 = daily_retention_purge()
		self.assertEqual(res2["bgcs_purged"], 0)

	def test_update_finding_verdict_recalculates_risk_with_politeness_score(self):
		"""Pengujian update_finding_verdict memperhitungkan politeness_score kandidat saat hitung risiko."""
		from hris_ats.hris_ats.doctype.background_check.background_check import update_finding_verdict

		init_res = initiate_background_check(self.applicant.name)
		bgc = frappe.get_doc("Background Check", init_res["name"])
		bgc.consent_status = "Granted"
		bgc.consent_method = "Uploaded document"
		bgc.consent_file = "/files/test_signed.pdf"
		bgc.politeness_score = 45  # < 60 menandakan risiko minimal Medium
		bgc.risk_level_auto = "Needs verification"
		bgc.save(ignore_permissions=True)

		f = frappe.get_doc({
			"doctype": "Background Check Finding",
			"background_check": bgc.name,
			"finding_type": "Article",
			"title": "Temuan Uji Verdict",
			"severity": "High",
			"match_confidence": 90,
			"hr_verdict": "Not reviewed",
		}).insert(ignore_permissions=True)

		# Pada severity High belum ditinjau, risiko = 'Needs verification'
		self.assertEqual(bgc.risk_level_auto, "Needs verification")

		# HR menandai 'Not this person' -> severity High gugur, tapi politeness_score < 60 tetap menghasilkan risiko 'Medium'
		res = update_finding_verdict(f.name, "Not this person", "Not the same person")
		self.assertEqual(res["new_risk"], "Medium")
		bgc.reload()
		self.assertEqual(bgc.risk_level_auto, "Medium")
