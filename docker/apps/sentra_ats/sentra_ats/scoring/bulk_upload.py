# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Bulk CV upload for a Job Opening: one Job Applicant per readable CV, processed in the
background so hundreds of files do not block the server. Screening then runs through the
normal Job Applicant hook."""

from __future__ import annotations

import json
import os
import re

import frappe
from frappe import _

from sentra_ats.scoring.extract import extract_cv
from sentra_ats.scoring.workflow import resolve_file_path

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+62|62|0)[\s\-]?8[\d\s\-]{7,14}\d")
MAX_FILES_PER_BATCH = 500
# A name line: 2-5 words, letters only, not a section title
NAME_LINE_RE = re.compile(r"^[A-Za-z][A-Za-z.'\- ]{2,60}$")
NOT_A_NAME = {"curriculum vitae", "resume", "cv", "daftar riwayat hidup", "riwayat hidup", "profil", "profile"}


def extract_contact(text: str, fallback_name: str) -> dict[str, str]:
	"""Email, phone and a best-effort name from the CV text (pure, used before the applicant exists)."""
	email = EMAIL_RE.search(text or "")
	phone = PHONE_RE.search(text or "")
	name = ""
	for line in (text or "").splitlines()[:8]:
		clean = line.strip()
		words = clean.split()
		is_capitalized = all(w[0].isupper() for w in words)
		if 2 <= len(words) <= 5 and is_capitalized and NAME_LINE_RE.match(clean) and clean.lower() not in NOT_A_NAME:
			name = clean.title() if clean.isupper() else clean
			break
	return {
		"email": email.group(0).lower() if email else "",
		"phone": re.sub(r"[\s\-]", "", phone.group(0)) if phone else "",
		"name": name or fallback_name,
	}


@frappe.whitelist()
def start_bulk_upload(job_opening: str, file_urls: str | list, consent_confirmed: int = 0) -> dict[str, str]:
	"""Create a batch and queue one job per file. HR must confirm candidate consent first."""
	frappe.has_permission("Job Applicant", "create", throw=True)
	if not int(consent_confirmed or 0):
		frappe.throw(
			_("Confirm that these candidates agreed to their data being processed for recruitment before uploading."),
			title=_("Consent Required"),
		)
	if not frappe.db.exists("Job Opening", job_opening):
		frappe.throw(_("Job Opening {0} not found.").format(job_opening))
	urls = json.loads(file_urls) if isinstance(file_urls, str) else list(file_urls)
	urls = [u for u in dict.fromkeys(urls) if u]
	if not urls:
		frappe.throw(_("Choose at least one CV file."))
	if len(urls) > MAX_FILES_PER_BATCH:
		frappe.throw(_("At most {0} files per upload.").format(MAX_FILES_PER_BATCH))

	batch = frappe.new_doc("Resume Upload Batch")
	batch.job_opening = job_opening
	batch.status = "Queued"
	batch.total_files = len(urls)
	batch.processed_files = 0
	batch.consent_confirmed = 1
	batch.consent_confirmed_by = frappe.session.user
	batch.consent_confirmed_on = frappe.utils.now_datetime()
	for url in urls:
		file_name = frappe.db.get_value("File", {"file_url": url}, "file_name") or os.path.basename(url)
		batch.append("items", {"file_url": url, "file_name": file_name, "status": "Queued"})
	batch.insert(ignore_permissions=True)
	frappe.db.commit()

	for row in batch.items:
		frappe.enqueue(
			"sentra_ats.scoring.bulk_upload.process_upload_item",
			queue="long",
			batch_name=batch.name,
			item_name=row.name,
		)
	return {"batch": batch.name}


def _set_item(item_name: str, **values) -> None:
	frappe.db.set_value("Resume Upload Batch Item", item_name, values, update_modified=False)


def _refresh_batch(batch_name: str) -> None:
	rows = frappe.get_all("Resume Upload Batch Item", filters={"parent": batch_name}, pluck="status")
	processed = sum(1 for s in rows if s not in ("Queued", "Processing"))
	status = "Done" if processed == len(rows) else "Processing"
	frappe.db.set_value("Resume Upload Batch", batch_name, {"processed_files": processed, "status": status})


def process_upload_item(batch_name: str, item_name: str) -> None:
	item = frappe.db.get_value(
		"Resume Upload Batch Item", item_name, ["file_url", "file_name", "status"], as_dict=True
	)
	if not item or item.status not in ("Queued", "Processing"):
		return
	job_opening = frappe.db.get_value("Resume Upload Batch", batch_name, "job_opening")
	_set_item(item_name, status="Processing")
	try:
		settings = frappe.get_single("Resume Screening Settings")
		extraction = extract_cv(
			resolve_file_path(item.file_url), min_text_chars_per_page=settings.min_text_chars_per_page or 200
		)
		if extraction.error:
			# Unreadable (scan, encrypted, unsupported): kept for manual review, no OCR
			_set_item(item_name, status="Needs Review", message=extraction.error)
			return
		stem = os.path.splitext(item.file_name or "")[0].replace("_", " ").replace("-", " ").strip()
		contact = extract_contact(extraction.raw_text or extraction.normalized_text, stem or _("Unnamed applicant"))
		if not contact["email"]:
			_set_item(
				item_name, status="Needs Review",
				message=_("No email address found in the CV. Create this applicant manually."),
			)
			return
		existing = frappe.db.get_value(
			"Job Applicant", {"email_id": contact["email"], "job_title": job_opening}, "name"
		)
		if existing:
			_set_item(item_name, status="Duplicate", job_applicant=existing,
				message=_("This candidate already applied to this job opening."))
			return

		applicant = frappe.new_doc("Job Applicant")
		applicant.applicant_name = contact["name"]
		applicant.email_id = contact["email"]
		if contact["phone"]:
			applicant.phone_number = contact["phone"]
		applicant.job_title = job_opening
		applicant.resume_attachment = item.file_url
		applicant.insert(ignore_permissions=True)
		# Attach the uploaded file to the applicant it now belongs to
		for file_name in frappe.get_all("File", filters={"file_url": item.file_url}, pluck="name"):
			frappe.db.set_value("File", file_name, {
				"attached_to_doctype": "Job Applicant",
				"attached_to_name": applicant.name,
				"attached_to_field": "resume_attachment",
			})
		_set_item(item_name, status="Created", job_applicant=applicant.name, message=contact["name"])
	except Exception as e:
		frappe.db.rollback()
		frappe.log_error(title="Bulk CV upload failed", message=frappe.get_traceback())
		_set_item(item_name, status="Failed", message=str(e)[:300])
	finally:
		_refresh_batch(batch_name)
		frappe.db.commit()
