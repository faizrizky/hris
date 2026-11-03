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

from hris_ats.scoring.engine import evaluate_resume
from hris_ats.scoring.extract import extract_cv


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


RULE_TABLES = {
	"metric_weights": ("metric", "weight", "enabled"),
	"score_labels": ("label_type", "score_from", "score_to", "label", "indicator", "description"),
	"penalty_rules": ("rule", "enabled", "points", "threshold", "secondary_threshold"),
	"custom_rules": ("label", "enabled", "section", "operator", "value", "count", "effect", "points"),
	"knockout_rules": ("condition", "enabled", "value", "match", "action", "cap_score", "description"),
}


def build_criteria(job_opening_name: str | None, applicant_name: str = "", city: str = "") -> dict[str, Any]:
	"""Job Opening criteria the metrics score against."""
	criteria: dict[str, Any] = {"applicant_name": applicant_name, "city": city}
	if job_opening_name and frappe.db.exists("Job Opening", job_opening_name):
		jo = frappe.get_doc("Job Opening", job_opening_name)
		for field in (
			"min_education", "education_majors", "min_years_experience", "relevant_titles",
			"required_skills", "preferred_skills", "certification_keywords",
		):
			criteria[field] = jo.get(field)
	return criteria


def template_config(template) -> dict[str, Any]:
	"""Plain-dict rules of a Resume Screening Template, as evaluate_resume expects them."""
	config: dict[str, Any] = {
		"min_score_to_pass": template.min_score_to_pass,
		"pass_description": template.pass_description,
		"fail_description": template.fail_description,
		"allowed_languages": template.get("allowed_languages") or "",
	}
	for table, fields in RULE_TABLES.items():
		config[table] = [{f: row.get(f) for f in fields} for row in (template.get(table) or [])]
	return config


def apply_result_to_screening(screening, result: dict[str, Any]) -> None:
	"""Copy an evaluate_resume result onto a Resume Screening document (not saved)."""
	screening.status = result["status"]
	screening.error = result["error"] if result["status"] != "Done" else None
	screening.resume_text = result["resume_text"]
	for field in (
		"base_score", "penalty_points", "total_score", "passed", "needs_hr_review", "result_label",
		"result_description", "result_indicator", "confidence", "confidence_reason", "detected_language",
		"review_reason",
	):
		screening.set(field, result.get(field))
	if result.get("experience_level"):
		screening.experience_level = result["experience_level"]
	screening.set("results", [])
	for r in result["results"]:
		screening.append("results", r)
	screening.set("rule_results", [])
	for r in result["rule_results"]:
		screening.append("rule_results", r)


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
	criteria = build_criteria(applicant.job_title, applicant.applicant_name, applicant.get("city") or "")

	# Snapshot of the criteria and the full template rules (version = template modified time)
	config = template_config(template)
	screening.template_version = str(template.modified)
	screening.criteria_snapshot = frappe.as_json({
		"criteria": criteria,
		"template": template_name,
		"template_version": str(template.modified),
		"rules": config,
	})

	# 3. Read the CV and score it with the template (same path as the template simulation)
	file_path = resolve_file_path(screening.resume_file or applicant.resume_attachment)
	extraction = extract_cv(file_path, min_text_chars_per_page=settings.min_text_chars_per_page or 200)

	def on_metric_done(metric_name: str, idx: int, total: int) -> None:
		frappe.publish_realtime(
			"resume_screening_progress",
			{
				"screening": screening.name,
				"metric": metric_name,
				"metric_status": "Done",
				"progress": int((idx / total) * 100),
				"status": "Screening",
			},
			doctype="Resume Screening",
			docname=screening.name,
		)

	result = evaluate_resume(
		extraction, config, criteria,
		metric_pass_threshold=settings.metric_pass_threshold or 60.0,
		on_metric_done=on_metric_done,
	)
	apply_result_to_screening(screening, result)
	screening.screened_on = frappe.utils.now_datetime()
	screening.save(ignore_permissions=True)

	if result["status"] == "Needs Review":
		applicant.db_set("resume_screening", screening.name)
		applicant.db_set("screening_status", "Needs Review")
		return

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
