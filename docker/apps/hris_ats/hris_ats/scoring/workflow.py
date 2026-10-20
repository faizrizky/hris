# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Alur otomatisasi Resume Screening, hooks Job Applicant, dan background job.
"""

from __future__ import annotations

import json
import os
from typing import Any

import frappe
from frappe import _

from hris_ats.scoring.engine import METRIC_MODULES
from hris_ats.scoring.extract import extract_cv
from hris_ats.scoring.sections import split_sections
from hris_ats.scoring.total import calculate_total_score


def resolve_file_path(file_url: str | None) -> str:
	"""Mencari lokasi absolut berkas pada filesystem."""
	if not file_url:
		return ""
	if os.path.isabs(file_url) and os.path.exists(file_url):
		return file_url

	try:
		from frappe.utils.file_manager import get_file_path
		p = get_file_path(file_url)
		if os.path.exists(p):
			return p
	except Exception:
		pass

	clean_url = file_url.lstrip("/")
	p1 = frappe.get_site_path(clean_url)
	if os.path.exists(p1):
		return p1
	p2 = frappe.get_site_path("public", clean_url)
	if os.path.exists(p2):
		return p2
	return p1


def get_template_for_job(job_opening_name: str | None) -> str | None:
	"""Memilih template screening berdasarkan prioritas:
	1. Job Opening.screening_template
	2. Template aktif yang memuat Designation lowongan
	"""
	if not job_opening_name:
		return None

	jo = frappe.get_doc("Job Opening", job_opening_name)
	if jo.get("screening_template"):
		return jo.screening_template

	if jo.designation:
		matched = frappe.db.sql(
			"""
			SELECT parent
			FROM `tabResume Screening Template Role`
			WHERE designation = %s
			  AND parent IN (SELECT name FROM `tabResume Screening Template` WHERE enabled = 1)
			ORDER BY modified DESC
			LIMIT 1
			""",
			(jo.designation,),
		)
		if matched:
			return matched[0][0]

	return None


def on_job_applicant_insert(doc, method=None):
	"""Hook saat Job Applicant baru dibuat."""
	# Set tahap awal New Applied
	if not doc.get("recruitment_stage"):
		doc.db_set("recruitment_stage", "New Applied")

	# Jika pelamar mendaftar dari web /jobs, beri source 'Website' bila belum diisi
	if not doc.get("source"):
		doc.db_set("source", "Website")

	trigger_screening_if_eligible(doc)


def on_job_applicant_update(doc, method=None):
	"""Hook saat Job Applicant diubah."""
	# Jika status pelamar diubah menjadi Rejected, pindahkan stage ke Rejected
	if doc.status == "Rejected" and doc.get("recruitment_stage") != "Rejected":
		doc.db_set("recruitment_stage", "Rejected")

	trigger_screening_if_eligible(doc)


def trigger_screening_if_eligible(doc):
	"""Memicu pembuatan dan penilaian Resume Screening jika resume terisi."""
	if not doc.get("resume_attachment"):
		return

	# Periksa pengaturan Resume Screening
	try:
		settings = frappe.get_single("Resume Screening Settings")
	except Exception:
		return

	if not settings.enabled or not settings.auto_screen:
		return

	# Periksa apakah sudah ada dokumen Resume Screening
	existing_name = frappe.db.get_value(
		"Resume Screening",
		{"job_applicant": doc.name},
		"name",
	)

	if existing_name:
		screening = frappe.get_doc("Resume Screening", existing_name)
		# Jika berkas resume sama dan status sudah Done/Screening, jangan proses ulang
		if screening.resume_file == doc.resume_attachment and screening.status in ("Done", "Screening"):
			return
		screening.resume_file = doc.resume_attachment
		screening.status = "Queued"
		screening.save(ignore_permissions=True)
	else:
		screening = frappe.new_doc("Resume Screening")
		screening.job_applicant = doc.name
		screening.resume_file = doc.resume_attachment
		screening.status = "Queued"
		screening.insert(ignore_permissions=True)

	doc.db_set("resume_screening", screening.name)
	doc.db_set("screening_status", "Queued")

	# Masukkan ke background queue long
	frappe.enqueue(
		"hris_ats.scoring.workflow.process_resume_screening",
		queue="long",
		screening_name=screening.name,
	)


def process_resume_screening(screening_name: str):
	"""Background job pemrosesan skrining resume."""
	if not frappe.db.exists("Resume Screening", screening_name):
		return

	screening = frappe.get_doc("Resume Screening", screening_name)
	applicant = frappe.get_doc("Job Applicant", screening.job_applicant)
	settings = frappe.get_single("Resume Screening Settings")

	# 1. Tentukan template
	template_name = screening.template or get_template_for_job(applicant.job_title)
	if not template_name:
		screening.status = "Failed"
		screening.error = _("No screening template configured for this position.")
		screening.result_label = _("Failed")
		screening.result_description = _("No screening template configured for this position.")
		screening.result_indicator = "red"
		screening.save(ignore_permissions=True)
		applicant.db_set("screening_status", "Failed")
		return

	screening.template = template_name
	screening.status = "Screening"
	screening.save(ignore_permissions=True)
	applicant.db_set("screening_status", "Screening")

	template = frappe.get_doc("Resume Screening Template", template_name)

	# 2. Siapkan kriteria dari Job Opening
	criteria = {
		"applicant_name": applicant.applicant_name,
		"city": applicant.get("city") or "",
	}

	if applicant.job_title and frappe.db.exists("Job Opening", applicant.job_title):
		jo = frappe.get_doc("Job Opening", applicant.job_title)
		criteria.update({
			"min_education": jo.get("min_education"),
			"education_majors": jo.get("education_majors"),
			"min_years_experience": jo.get("min_years_experience"),
			"relevant_titles": jo.get("relevant_titles"),
			"required_skills": jo.get("required_skills"),
			"preferred_skills": jo.get("preferred_skills"),
			"certification_keywords": jo.get("certification_keywords"),
		})

	# Simpan snapshot kriteria
	screening.criteria_snapshot = frappe.as_json({
		"criteria": criteria,
		"template": template_name,
		"weights": [w.as_dict() for w in template.metric_weights],
	})

	# 3. Cari berkas resume
	file_path = resolve_file_path(screening.resume_file or applicant.resume_attachment)
	extraction = extract_cv(file_path, min_text_chars_per_page=settings.min_text_chars_per_page or 200)

	if extraction.error:
		screening.status = "Failed"
		screening.error = extraction.error
		screening.resume_text = extraction.raw_text
		screening.total_score = 0.0
		screening.passed = 0
		screening.result_label = _("Failed Evaluation")
		screening.result_description = extraction.error
		screening.result_indicator = "red"
		screening.save(ignore_permissions=True)
		applicant.db_set("screening_status", "Failed")
		return

	# 4. Ekstraksi bagian dan jalankan metrik satu per satu
	sections = split_sections(extraction.normalized_text)
	screening.resume_text = extraction.normalized_text
	screening.set("results", [])

	metric_results = []
	total_experience_years = 0.0
	total_metrics = len(METRIC_MODULES)

	for idx, (metric_name, module) in enumerate(METRIC_MODULES, start=1):
		eval_res = module.evaluate(extraction, sections, criteria)
		metric_results.append({
			"metric": metric_name,
			"score": eval_res["score"],
			"applicable": eval_res["applicable"],
			"reason": eval_res["reason"],
			"reason_template": eval_res.get("reason_template", eval_res["reason"]),
			"reason_params": eval_res.get("reason_params", "{}"),
		})
		if metric_name == "Experience relevance":
			total_experience_years = float(eval_res.get("total_years", 0.0))

		# Publish progress realtime per metrik
		frappe.publish_realtime(
			"resume_screening_progress",
			{
				"screening": screening.name,
				"metric": metric_name,
				"metric_status": "Done",
				"progress": int((idx / total_metrics) * 100),
				"status": "Screening",
			},
			doctype="Resume Screening",
			docname=screening.name,
		)

	# 5. Kalkulasi skor total
	weights_data = [w.as_dict() for w in template.metric_weights]
	labels_data = [l.as_dict() for l in template.score_labels]

	total_calc = calculate_total_score(
		metric_results=metric_results,
		metric_weights=weights_data,
		min_score_to_pass=template.min_score_to_pass,
		pass_description=template.pass_description,
		fail_description=template.fail_description,
		score_labels=labels_data,
		metric_pass_threshold=settings.metric_pass_threshold or 60.0,
	)

	for r in total_calc["results"]:
		screening.append("results", r)

	screening.total_score = total_calc["total_score"]
	screening.passed = total_calc["passed"]
	screening.experience_level = "Experienced" if total_experience_years >= 1.0 else "Fresh Graduate"
	screening.result_label = total_calc["result_label"]
	screening.result_description = total_calc["result_description"]
	screening.result_indicator = total_calc["result_indicator"]
	screening.screened_on = frappe.utils.now_datetime()
	screening.status = "Done"
	screening.error = None
	screening.save(ignore_permissions=True)

	# 6. Salin hasil ke Job Applicant dan transisi stage ke 'Screening'
	applicant.db_set("resume_screening", screening.name)
	applicant.db_set("resume_score", screening.total_score)
	applicant.db_set("screening_status", "Done")
	if applicant.get("recruitment_stage") in ("New Applied", None):
		applicant.db_set("recruitment_stage", "Screening")

	# Beri tahu form Job Applicant yang sedang terbuka agar memuat ulang sendiri
	frappe.publish_realtime(
		"hris_ats_screening_finished",
		{"applicant": applicant.name, "score": screening.total_score},
		doctype="Job Applicant",
		docname=applicant.name,
	)

	# Publish complete realtime event
	frappe.publish_realtime(
		"resume_screening_progress",
		{
			"screening": screening.name,
			"progress": 100,
			"status": "Done",
			"total_score": screening.total_score,
			"result_label": screening.result_label,
		},
		doctype="Resume Screening",
		docname=screening.name,
	)

	# 7. Notification Log ke pembuat lowongan
	if applicant.job_title:
		jo_owner = frappe.db.get_value("Job Opening", applicant.job_title, "owner")
		if jo_owner and jo_owner != "Administrator":
			try:
				notif = frappe.new_doc("Notification Log")
				notif.for_user = jo_owner
				notif.from_user = "Administrator"
				notif.subject = _("Resume screening completed: {0} ({1} points)").format(
					applicant.applicant_name, screening.total_score
				)
				notif.type = "Alert"
				notif.document_type = "Resume Screening"
				notif.document_name = screening.name
				notif.insert(ignore_permissions=True)
			except Exception:
				pass


@frappe.whitelist()
def rescreen(screening_name: str) -> dict[str, Any]:
	"""Aksi 'Screen Ulang' di form Resume Screening."""
	if not frappe.db.exists("Resume Screening", screening_name):
		frappe.throw(_("Resume Screening document {0} not found.").format(screening_name))

	frappe.has_permission("Resume Screening", "write", screening_name, throw=True)
	screening = frappe.get_doc("Resume Screening", screening_name)
	screening.status = "Queued"
	screening.save()

	frappe.enqueue(
		"hris_ats.scoring.workflow.process_resume_screening",
		queue="long",
		screening_name=screening.name,
	)
	return {"status": "Queued", "name": screening.name}


@frappe.whitelist()
def bulk_rescreen(applicant_names: list[str] | str) -> dict[str, Any]:
	"""Aksi massal 'Screen Ulang' dari list Job Applicant."""
	if isinstance(applicant_names, str):
		applicant_names = json.loads(applicant_names)

	queued = []
	for app_name in applicant_names:
		screening_name = frappe.db.get_value("Resume Screening", {"job_applicant": app_name}, "name")
		if screening_name:
			rescreen(screening_name)
			queued.append(screening_name)
		else:
			frappe.has_permission("Job Applicant", "write", app_name, throw=True)
			app_doc = frappe.get_doc("Job Applicant", app_name)
			trigger_screening_if_eligible(app_doc)
			queued.append(app_name)

	return {"message": _("{0} applicants scheduled for rescreening.").format(len(queued)), "count": len(queued)}


@frappe.whitelist()
def rescreen_applicant(applicant_name: str) -> dict[str, Any]:
	"""Aksi 'Screen Ulang' langsung dari form Job Applicant."""
	if not frappe.db.exists("Job Applicant", applicant_name):
		frappe.throw(_("Applicant {0} not found.").format(applicant_name))
	frappe.has_permission("Job Applicant", "write", applicant_name, throw=True)

	screening_name = frappe.db.get_value("Resume Screening", {"job_applicant": applicant_name}, "name")
	if screening_name:
		return rescreen(screening_name)
	else:
		app_doc = frappe.get_doc("Job Applicant", applicant_name)
		trigger_screening_if_eligible(app_doc)
		return {"status": "Queued", "applicant": applicant_name}


def validate_interview(doc, method=None):
	"""Validasi sebelum Interview disimpan:
	Jika pelamar memiliki berkas Background Check, hr_conclusion wajib diisi terlebih dahulu.
	"""
	if not doc.get("job_applicant"):
		return

	# Prioritaskan BGC yang terhubung langsung di Job Applicant
	bgc_name = frappe.db.get_value("Job Applicant", doc.job_applicant, "background_check")
	if not bgc_name:
		# Jika belum ditautkan di field, cari BGC aktif terbaru
		bgc_records = frappe.get_all(
			"Background Check",
			filters={"job_applicant": doc.job_applicant, "consent_status": ["!=", "Withdrawn"]},
			fields=["name"],
			order_by="creation desc",
			limit=1,
		)
		if bgc_records:
			bgc_name = bgc_records[0].name

	if bgc_name:
		bgc = frappe.db.get_value(
			"Background Check",
			bgc_name,
			["name", "hr_conclusion", "status", "consent_status"],
			as_dict=True,
		)
		if bgc and bgc.consent_status != "Withdrawn":
			if not bgc.hr_conclusion or not bgc.hr_conclusion.strip():
				frappe.throw(
					_("Interview cannot be created before HR Conclusion (hr_conclusion) is filled on Background Check {0}.").format(bgc.name),
					frappe.ValidationError,
				)


def on_interview_update(doc, method=None):
	"""Perpindahan tahap ke Interview saat wawancara dibuat."""
	if doc.get("job_applicant"):
		frappe.db.set_value("Job Applicant", doc.job_applicant, "recruitment_stage", "Interview")


def on_job_offer_update(doc, method=None):
	"""Perpindahan tahap ke Offer saat Job Offer dibuat / Hired saat Accepted."""
	if doc.get("job_applicant"):
		if doc.get("status") == "Accepted":
			frappe.db.set_value("Job Applicant", doc.job_applicant, "recruitment_stage", "Hired")
		else:
			frappe.db.set_value("Job Applicant", doc.job_applicant, "recruitment_stage", "Offer")
