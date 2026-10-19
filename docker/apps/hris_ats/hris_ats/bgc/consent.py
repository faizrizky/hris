# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Manajemen persetujuan kandidat (Candidate Consent) untuk Background Check.
Sesuai kepatuhan UU PDP: tautan bertoken sekali pakai yang kedaluwarsa,
pencatatan versi teks, IP, waktu, centang per sumber, dan penarikan persetujuan.
"""

from __future__ import annotations

import json
from typing import Any
import frappe
from frappe import _
from frappe.utils import now_datetime, get_url


@frappe.whitelist()
def initiate_background_check(applicant_name: str, candidate_language: str = "id") -> dict[str, Any]:
	"""Start background check button on Job Applicant."""
	if not frappe.db.exists("Job Applicant", applicant_name):
		frappe.throw(_("Job Applicant {0} not found.").format(applicant_name))

	applicant = frappe.get_doc("Job Applicant", applicant_name)

	# Validation: Background check only for applicants with screening Done
	if applicant.screening_status != "Done":
		frappe.throw(_("Background check can only be started for applicants with screening status 'Done'."))

	# Check if Background Check document already exists for this applicant
	existing_bgc = frappe.db.get_value("Background Check", {"job_applicant": applicant.name}, "name")
	if existing_bgc:
		bgc = frappe.get_doc("Background Check", existing_bgc)
		if candidate_language and not bgc.candidate_language:
			bgc.candidate_language = candidate_language
			bgc.save(ignore_permissions=True)
	else:
		bgc = frappe.new_doc("Background Check")
		bgc.job_applicant = applicant.name
		bgc.full_name = applicant.applicant_name
		bgc.email = applicant.email_id
		bgc.phone = applicant.phone_number
		bgc.candidate_language = candidate_language or "id"

		# Context terms from Resume Screening
		context_items = []
		if applicant.get("city"):
			context_items.append(applicant.city)
		if applicant.job_title:
			context_items.append(frappe.db.get_value("Job Opening", applicant.job_title, "job_title") or "")
		bgc.context_terms = ", ".join(filter(None, context_items))

		# Initial name variants
		names = applicant.applicant_name.split()
		variants = [applicant.applicant_name]
		if len(names) >= 2:
			variants.append(f"{names[0]} {names[-1]}")
		bgc.name_variants = "\n".join(variants)

		bgc.consent_status = "Pending"
		bgc.status = "Waiting Consent"
		bgc.insert(ignore_permissions=True)

	# Update recruitment_stage on Job Applicant
	applicant.db_set("recruitment_stage", "Background Check")
	applicant.db_set("background_check", bgc.name)

	# Send consent email to candidate in their preferred candidate_language
	cand_lang = bgc.candidate_language or "id"
	if bgc.email and bgc.consent_token:
		consent_url = f"{get_url()}/ats-consent?token={bgc.consent_token}&lang={cand_lang}"
		if cand_lang == "en":
			subject = "Background Check Consent - Recruitment"
			message = f"""
			<p>Hello {bgc.full_name},</p>
			<p>Thank you for participating in our recruitment process. In accordance with personal data protection regulations,
			we require your explicit consent prior to conducting a background check.</p>
			<p>Please follow the link below to review the screening sources and submit your consent:</p>
			<p><a href="{consent_url}" style="display:inline-block;padding:10px 18px;background-color:#2b6cb0;color:#fff;text-decoration:none;border-radius:4px;">Open Consent Form</a></p>
			<p><small>This link is confidential, single-use, and expires in 7 days.</small></p>
			"""
		else:
			subject = "Persetujuan Pemeriksaan Latar Belakang - Rekrutmen"
			message = f"""
			<p>Halo {bgc.full_name},</p>
			<p>Terima kasih telah mengikuti tahapan rekrutmen. Sesuai ketentuan perlindungan data pribadi (UU PDP),
			kami memerlukan persetujuan Anda sebelum melakukan pemeriksaan latar belakang.</p>
			<p>Silakan buka tautan berikut untuk meninjau sumber pemeriksaan dan memberikan persetujuan:</p>
			<p><a href="{consent_url}" style="display:inline-block;padding:10px 18px;background-color:#2b6cb0;color:#fff;text-decoration:none;border-radius:4px;">Buka Formulir Persetujuan</a></p>
			<p><small>Tautan ini bersifat rahasia, sekali pakai, dan kedaluwarsa dalam 7 hari.</small></p>
			"""
		try:
			frappe.sendmail(
				recipients=[bgc.email],
				subject=subject,
				message=message,
				now=False,  # Use standard email queue
			)
		except frappe.OutgoingEmailError:
			frappe.log_error(title="BGC Consent Email Failed", message=f"OutgoingEmailError sending consent email to {bgc.email}")

	return {
		"message": _("Background Check created successfully and consent invitation sent."),
		"name": bgc.name,
		"token": bgc.consent_token,
	}


@frappe.whitelist(allow_guest=True)
def submit_candidate_consent(
	token: str,
	granted_sources: list[str] | str,
	accounts: list[dict[str, Any]] | str | None = None,
	skck_file: str | None = None,
	consent_language: str | None = None,
) -> dict[str, Any]:
	"""Endpoint receiving consent submission from candidate Web Form."""
	if not token:
		frappe.throw(_("Consent token is invalid or missing."))

	bgc_name = frappe.db.get_value("Background Check", {"consent_token": token}, "name")
	if not bgc_name:
		frappe.throw(_("Consent token is invalid or has already been used."))

	bgc = frappe.get_doc("Background Check", bgc_name)

	# Validate token expiry
	if bgc.consent_token_expires_at and bgc.consent_token_expires_at < now_datetime():
		frappe.throw(_("Consent link has expired. Please contact the HR team."))

	if bgc.consent_status != "Pending":
		frappe.throw(_("Consent for this record has already been processed."))

	if isinstance(granted_sources, str):
		try:
			granted_sources = json.loads(granted_sources)
		except Exception:
			granted_sources = [s.strip() for s in granted_sources.split(",") if s.strip()]

	if isinstance(accounts, str):
		try:
			accounts = json.loads(accounts)
		except Exception:
			accounts = []

	# Update consent scope
	for row in bgc.consent_scope:
		row.granted = 1 if row.source in granted_sources else 0

	existing_sources = {row.source for row in bgc.consent_scope}
	if "Social Media" not in existing_sources:
		bgc.append("consent_scope", {
			"source": "Social Media",
			"granted": 1 if "Social Media" in granted_sources else 0,
		})

	# Save social media and other accounts declared by candidate
	is_social_granted = "Social Media" in granted_sources
	submitted_consented_keys = set()
	if accounts:
		existing_accounts_map = {
			(acc.platform, acc.username): acc for acc in bgc.accounts
		}
		for acc in accounts:
			plat = acc.get("platform")
			user = acc.get("username")
			if not plat or not user:
				continue
			has_consent = 1 if (is_social_granted and acc.get("social_consent")) else 0
			key = (plat, user)
			if has_consent:
				submitted_consented_keys.add(key)
			prof_url = ""
			if frappe.db.exists("Background Check Platform", plat):
				tmpl = frappe.db.get_value("Background Check Platform", plat, "profile_url_template")
				if tmpl:
					prof_url = tmpl.replace("{username}", user.strip().lstrip("@"))

			if key in existing_accounts_map:
				existing_accounts_map[key].social_consent = has_consent
				if prof_url and not existing_accounts_map[key].profile_url:
					existing_accounts_map[key].profile_url = prof_url
			else:
				bgc.append("accounts", {
					"platform": plat,
					"username": user,
					"profile_url": prof_url,
					"declared_by": "Candidate",
					"post_access": "Manual review only",
					"social_consent": has_consent,
				})

	# Ensure any account not explicitly consented by candidate has social_consent = 0
	for acc in bgc.accounts:
		if (acc.platform, acc.username) not in submitted_consented_keys:
			acc.social_consent = 0

	# Optional SKCK file
	if skck_file:
		bgc.skck_file = skck_file
		bgc.skck_status = "Not checked"

	# Get consent text version from Settings
	settings = frappe.get_single("Background Check Settings")
	bgc.consent_text_version = settings.consent_text_version or "v1.0"
	bgc.consent_at = now_datetime()
	bgc.consent_ip = getattr(frappe.local, "request_ip", "web_client")
	bgc.consent_language = consent_language or bgc.candidate_language or "id"
	bgc.consent_status = "Granted"
	bgc.status = "Queued"

	# Burn single-use token
	bgc.consent_token = None

	bgc.save(ignore_permissions=True)

	# Enqueue crawling/analysis in long queue
	frappe.enqueue(
		"hris_ats.bgc.runner.run_all_sources",
		queue="long",
		bgc_name=bgc.name,
	)

	return {
		"success": True,
		"message": _("Consent recorded successfully. Thank you."),
		"name": bgc.name,
	}


def clean_bgc_crawldir(bgc_name: str) -> None:
	"""Hapus direktori crawl untuk dokumen Background Check."""
	try:
		import os
		import shutil
		from hris_ats.bgc.providers.court_ma import get_crawldir
		cdir = get_crawldir(bgc_name)
		if os.path.exists(cdir):
			shutil.rmtree(cdir, ignore_errors=True)
	except Exception:
		pass


def clean_bgc_cache(bgc_doc: Any) -> None:
	"""Bersihkan entri cache Redis yang terkait dengan akun Background Check."""
	try:
		if hasattr(frappe, "cache") and frappe.cache:
			for acc in getattr(bgc_doc, "accounts", []):
				prof_url = getattr(acc, "profile_url", None)
				if prof_url:
					for mode in ("company+robots", "company", "browser+robots", "browser", "stealth+robots", "stealth", "mock"):
						key = f"hris_ats:fetch_cache:{mode}:GET:{prof_url}"
						frappe.cache.delete_value(key)
	except Exception:
		pass


@frappe.whitelist()
def revoke_consent(bgc_name: str) -> dict[str, Any]:
	"""Revoke consent: delete all raw findings, crawl directory, and Redis cache in accordance with PDP regulations."""
	if not frappe.db.exists("Background Check", bgc_name):
		frappe.throw(_("Document {0} not found.").format(bgc_name))

	count = frappe.db.count("Background Check Finding", {"background_check": bgc_name})
	frappe.db.delete("Background Check Finding", {"background_check": bgc_name})

	bgc = frappe.get_doc("Background Check", bgc_name)
	bgc.consent_status = "Withdrawn"
	bgc.status = "Done"

	# Clear derived data on accounts in compliance with PDP right to erasure
	for acc in bgc.accounts:
		acc.display_name = ""
		acc.bio_snippet = ""
		acc.profile_location = ""
		acc.identity_match = None
		acc.identity_reasons = ""
		acc.identity_reasons_template = ""
		acc.identity_reasons_params = "{}"
		acc.social_consent = 0

	clean_bgc_crawldir(bgc.name)
	clean_bgc_cache(bgc)

	bgc.save(ignore_permissions=True)

	return {
		"message": _("Consent withdrawn. {0} findings deleted.").format(count),
		"findings_deleted": count,
	}

