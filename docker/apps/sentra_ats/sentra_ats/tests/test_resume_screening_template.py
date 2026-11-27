# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe.exceptions import ValidationError
from frappe.tests.utils import FrappeTestCase


class TestResumeScreeningTemplate(FrappeTestCase):
	def setUp(self):
		# Jalankan pengujian sebagai HR Manager sesuai Spesifikasi 8
		from sentra_ats.tests import ensure_test_hr_user
		self.hr_user = ensure_test_hr_user("hr.test@example.com")
		frappe.set_user(self.hr_user)

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_default_metric_weights_populated(self):
		"""Template baru otomatis memuat 9 metrik default dengan total bobot 100%."""
		template = frappe.new_doc("Resume Screening Template")
		template.template_name = "Test Default Weights Template"
		template.insert()

		self.assertEqual(len(template.metric_weights), 9)
		self.assertEqual(template.total_weight, 100)
		self.assertIn("Applicant resume is match", template.pass_description)

	def test_validate_total_weight_not_100(self):
		"""Validasi menolak total bobot metrik aktif yang tidak sama dengan 100%."""
		template = frappe.new_doc("Resume Screening Template")
		template.template_name = "Test Invalid Weight Template"
		template.insert()

		# Ubah bobot salah satu metrik sehingga total = 90
		template.metric_weights[0].weight = 0
		with self.assertRaises(ValidationError) as cm:
			template.save()
		self.assertIn("Total active metric weight must equal 100%", str(cm.exception))

	def test_validate_duplicate_or_missing_metrics(self):
		"""Validasi menolak metrik duplikat atau kurang."""
		template = frappe.new_doc("Resume Screening Template")
		template.template_name = "Test Duplicate Metric Template"
		template.insert()

		# Duplikasi metrik pertama
		template.metric_weights[1].metric = template.metric_weights[0].metric
		with self.assertRaises(ValidationError) as cm:
			template.save()
		self.assertIn("appears more than once", str(cm.exception))

	def test_validate_score_label_range_invalid(self):
		"""Validasi menolak label rentang dengan score_from > score_to."""
		template = frappe.new_doc("Resume Screening Template")
		template.template_name = "Test Invalid Label Template"
		template.append("score_labels", {
			"label_type": "Range",
			"score_from": 80,
			"score_to": 60,
			"label": "Invalid Range",
			"indicator": "red",
		})
		with self.assertRaises(ValidationError) as cm:
			template.insert()
		self.assertIn("must be less than or equal to", str(cm.exception))

	def test_validate_score_label_overlapping(self):
		"""Validasi menolak rentang label yang saling tumpang tindih."""
		template = frappe.new_doc("Resume Screening Template")
		template.template_name = "Test Overlapping Labels Template"
		template.append("score_labels", {
			"label_type": "Range",
			"score_from": 50,
			"score_to": 75,
			"label": "Medium",
			"indicator": "orange",
		})
		template.append("score_labels", {
			"label_type": "Range",
			"score_from": 70,
			"score_to": 90,
			"label": "High",
			"indicator": "green",
		})
		with self.assertRaises(ValidationError) as cm:
			template.insert()
		self.assertIn("overlaps with label", str(cm.exception))

	def test_validate_active_designation_unique(self):
		"""Satu Designation hanya boleh dipakai di satu template aktif."""
		des_name = "Unique Test Designation"
		if not frappe.db.exists("Designation", des_name):
			des = frappe.get_doc({"doctype": "Designation", "designation_name": des_name}).insert(ignore_permissions=True)
			designation = des.name
		else:
			designation = des_name

		# Template aktif pertama
		t1 = frappe.new_doc("Resume Screening Template")
		t1.template_name = "Test Template Active 1"
		t1.enabled = 1
		t1.append("job_roles", {"designation": designation})
		t1.insert()

		# Template aktif kedua dengan jabatan yang sama
		t2 = frappe.new_doc("Resume Screening Template")
		t2.template_name = "Test Template Active 2"
		t2.enabled = 1
		t2.append("job_roles", {"designation": designation})
		with self.assertRaises(ValidationError) as cm:
			t2.insert()
		self.assertIn("is already used in active template", str(cm.exception))

		# Template kedua nonaktif (enabled = 0) diperbolehkan
		t2.enabled = 0
		t2.insert()
		self.assertEqual(t2.enabled, 0)

	def test_validate_blueprint_rules(self):
		"""Red flag ganda, regex rusak, dan bahasa di luar id/en ditolak."""
		template = frappe.new_doc("Resume Screening Template")
		template.template_name = "Test Blueprint Rules Template"
		template.insert()
		# before_insert menambahkan 4 red flag nonaktif dan tier bawaan
		self.assertEqual(len(template.penalty_rules), 4)
		self.assertTrue(template.score_labels)

		template.append("penalty_rules", {"rule": "Brevity", "points": 5})
		with self.assertRaises(ValidationError):
			template.save()
		template.penalty_rules = template.penalty_rules[:4]

		template.append("custom_rules", {"label": "Bad", "operator": "Matches regex", "value": "(", "effect": "Flag only"})
		with self.assertRaises(ValidationError):
			template.save()
		template.custom_rules = []

		template.allowed_languages = "id,fr"
		with self.assertRaises(ValidationError):
			template.save()

	def test_level_presets_installed(self):
		names = frappe.get_all("Resume Screening Template", filters={"name": ["like", "ATS Preset%"]}, pluck="name")
		self.assertEqual(len(names), 4)
		preset = frappe.get_doc("Resume Screening Template", "ATS Preset - Senior / Manager")
		self.assertEqual(preset.total_weight, 100)
		self.assertEqual(preset.min_score_to_pass, 80)

	def test_bulk_upload_requires_consent(self):
		from sentra_ats.scoring.bulk_upload import start_bulk_upload

		with self.assertRaises(ValidationError):
			start_bulk_upload("any-job", ["/private/files/a.pdf"], consent_confirmed=0)
