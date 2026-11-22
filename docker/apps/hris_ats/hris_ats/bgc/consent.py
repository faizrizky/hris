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
from frappe.utils import get_url, now_datetime


@frappe.whitelist()
def initiate_background_check(applicant_name: str, candidate_language: str = "id") -> dict[str, Any]:
	"""Start background check button on Job Applicant."""
	if not frappe.db.exists("Job Applicant", applicant_name):
		frappe.throw(_("Job Applicant {0} not found.").format(applicant_name))

	frappe.has_permission("Job Applicant", "write", applicant_name, throw=True)
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


def normalize_username(platform: str, raw: str) -> str:
	"""Turn what the candidate typed into a platform username.

	Accepts a handle ("@name"), or a pasted profile URL. A display name with spaces is rejected,
	because it would produce a profile URL that does not exist.
	"""
	import re
	from urllib.parse import unquote, urlparse

	value = (raw or "").strip()
	if re.match(r"^https?://", value, re.IGNORECASE) or re.match(r"^(www\.)?[a-z0-9-]+\.[a-z]{2,}/", value, re.IGNORECASE):
		parsed = urlparse(value if "://" in value else "https://" + value)
		parts = [unquote(p) for p in parsed.path.split("/") if p]
		if platform == "LinkedIn" and "in" in parts and parts.index("in") + 1 < len(parts):
			value = parts[parts.index("in") + 1]
		elif platform == "Facebook" and parts and parts[0] == "profile.php":
			value = (parse_qs_first(parsed.query, "id") or "").strip()
		elif parts:
			value = parts[0]
		else:
			value = ""
	value = value.lstrip("@").strip()
	if not value or re.search(r"\s", value) or not re.fullmatch(r"[A-Za-z0-9._%-]+", value):
		frappe.throw(
			_("The username for {0} must be the handle from your profile link (for example: {1}), not your display name.").format(
				platform, {"Instagram": "faiz.rizky", "TikTok": "faiz.rizky", "Facebook": "faiz.rizky.123", "LinkedIn": "muhammad-faiz-rizky", "Threads": "faiz.rizky"}.get(platform, "username")
			),
			title=_("Invalid Username"),
		)
	return value


def parse_qs_first(query: str, key: str) -> str | None:
	from urllib.parse import parse_qs

	vals = parse_qs(query).get(key)
	return vals[0] if vals else None


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
	submitted_account_keys = set()
	if accounts:
		existing_accounts_map = {
			(acc.platform, acc.username): acc for acc in bgc.accounts
		}
		for acc in accounts:
			plat = acc.get("platform")
			user = acc.get("username")
			if not plat or not user:
				continue
			if plat in ("Instagram", "TikTok", "Facebook", "LinkedIn", "Threads"):
				user = normalize_username(plat, user)
				acc["username"] = user
			has_consent = 1 if (is_social_granted and acc.get("social_consent")) else 0
			key = (plat, user)
			submitted_account_keys.add(key)
			if has_consent:
				submitted_consented_keys.add(key)
			prof_url = ""
			plat_post_api = None
			if frappe.db.exists("Background Check Platform", plat):
				tmpl = frappe.db.get_value("Background Check Platform", plat, "profile_url_template")
				if tmpl:
					prof_url = tmpl.replace("{username}", user.strip().lstrip("@"))
				plat_post_api = frappe.db.get_value("Background Check Platform", plat, "post_api")

			post_access = "API" if (plat_post_api and plat_post_api != "None") else "Manual review only"

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
					"post_access": post_access,
					"social_consent": has_consent,
				})

	# If candidate previously declared an account and deleted it on the form, remove it
	retained_accounts = []
	for acc in bgc.accounts:
		key = (acc.platform, acc.username)
		if acc.declared_by == "Candidate" and key not in submitted_account_keys:
			continue
		if key not in submitted_consented_keys:
			acc.social_consent = 0
		retained_accounts.append(acc)
	bgc.accounts = retained_accounts

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

	# Process candidate export data if uploaded alongside consent
	if is_social_granted and accounts:
		import base64

		from hris_ats.bgc.export_processor import process_candidate_export_data
		for acc in accounts:
			if not acc.get("social_consent"):
				continue
			plat = acc.get("platform")
			user = acc.get("username")
			export_b64 = acc.get("export_base64")
			if plat and user and export_b64:
				raw_b64 = export_b64
				if "," in raw_b64:
					raw_b64 = raw_b64.split(",", 1)[1]
				try:
					archive_bytes = base64.b64decode(raw_b64)
					process_candidate_export_data(
						bgc_name=bgc.name,
						platform=plat,
						username=user,
						archive_bytes=archive_bytes,
					)
				except Exception:
					frappe.log_error(title=f"BGC Export Processing Error: {plat}", message=frappe.get_traceback())
					raise

	# Enqueue crawling/analysis in long queue
	frappe.enqueue(
		"hris_ats.bgc.runner.run_all_sources",
		queue="long",
		# Worker tidak boleh membaca dokumen sebelum transaksi ini commit (QueryDeadlockError 1020).
		enqueue_after_commit=True,
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
			from hris_ats.bgc.fetch import get_cache_key
			for acc in getattr(bgc_doc, "accounts", []):
				prof_url = getattr(acc, "profile_url", None)
				if not prof_url and getattr(acc, "platform", None) and getattr(acc, "username", None):
					tmpl = frappe.db.get_value("Background Check Platform", acc.platform, "profile_url_template")
					if tmpl:
						prof_url = tmpl.replace("{username}", acc.username.strip().lstrip("@"))
				if prof_url:
					urls_to_clean = {prof_url, prof_url.rstrip("/"), prof_url.rstrip("/") + "/"}
					modes = tuple(
							f"{base}{suffix}"
							for base in ("company", "browser", "stealth", "session", "mock")
							for suffix in ("", "+robots", "+session")
						)
					methods = ("GET", "HEAD")
					for u in urls_to_clean:
						for mode in modes:
							for method in methods:
								key = get_cache_key(u, mode, method)
								frappe.cache.delete_value(key)
	except Exception:
		pass


def delete_file_record_and_disk(file_url: str | None) -> None:
	"""Hapus dokumen File di database dan berkas fisik terkait di disk."""
	if not file_url:
		return
	try:
		files = frappe.get_all("File", filters={"file_url": file_url}, pluck="name")
		for f in files:
			frappe.delete_doc("File", f, ignore_permissions=True, force=True)
	except Exception:
		pass
	try:
		import os
		site_path = frappe.get_site_path()
		clean_url = file_url.strip()
		if clean_url.startswith("/files/"):
			disk_path = os.path.join(site_path, "public", clean_url.lstrip("/"))
		elif clean_url.startswith("/private/files/"):
			disk_path = os.path.join(site_path, clean_url.lstrip("/"))
		else:
			disk_path = os.path.join(site_path, "public", "files", os.path.basename(clean_url))
		if os.path.exists(disk_path):
			os.remove(disk_path)
	except Exception:
		pass


@frappe.whitelist()
def revoke_consent(bgc_name: str) -> dict[str, Any]:
	"""Revoke consent: delete all raw findings, crawl directory, Redis cache, and SKCK file in accordance with PDP regulations."""
	if not frappe.db.exists("Background Check", bgc_name):
		frappe.throw(_("Document {0} not found.").format(bgc_name))
	frappe.has_permission("Background Check", "write", bgc_name, throw=True)

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
		acc.social_consent_attested_by = None
		acc.social_consent_attested_on = None

	# Hapus berkas SKCK fisik dan field (Spesifikasi 8 tidak mengizinkan menyimpannya; pertahankan skck_status)
	if bgc.skck_file:
		delete_file_record_and_disk(bgc.skck_file)
		bgc.skck_file = None

	clean_bgc_crawldir(bgc.name)
	clean_bgc_cache(bgc)

	bgc.save(ignore_permissions=True)

	return {
		"message": _("Consent withdrawn. {0} findings deleted.").format(count),
		"findings_deleted": count,
	}


class SocialConsentError(frappe.PermissionError):
	"""Dilemparkan bila persetujuan kandidat untuk pemeriksaan media sosial tidak terpenuhi."""
	pass


def assert_social_consent(
	bgc: Any,
	account: Any,
	blocked_domains: list[str] | None = None,
) -> bool:
	"""Penjaga persetujuan kandidat terpusat (Spesifikasi 3.1 & 3b).

	Memeriksa:
	1. Persetujuan umum diberikan (bgc.consent_status == 'Given' atau 'Granted').
	2. Sumber 'Social Media' disetujui (pada consent_scope terdapat row source='Social Media' dengan granted=1).
	3. Akun spesifik kandidat dicentang persetujuannya (account.social_consent == 1).
	4. Domain profil akun tidak masuk dalam daftar terblokir (settings.fetch_blocked_domains).

	Dipakai oleh SEMUA jalur (crawl publik, sesi akun crawler, ekspor kandidat, OAuth).
	Nol permintaan jaringan dan nol temuan boleh dihasilkan bila fungsi ini gagal.
	"""
	if not bgc:
		frappe.throw(_("Background Check reference is required for social consent."), SocialConsentError)

	consent_status = getattr(bgc, "consent_status", "")
	if consent_status not in ("Given", "Granted"):
		frappe.throw(
			_("Candidate consent has not been given (status: {0}).").format(consent_status),
			SocialConsentError,
		)

	consent_method = getattr(bgc, "consent_method", "")
	if consent_method == "Uploaded document" and not getattr(bgc, "consent_file", None):
		frappe.throw(_("Signed consent document file is missing."), SocialConsentError)

	# 2. Scope 'Social Media' granted
	has_social_scope = False
	consent_scope_rows = getattr(bgc, "consent_scope", []) or []
	for row in consent_scope_rows:
		source_val = getattr(row, "source", None) or (row.get("source") if isinstance(row, dict) else "")
		granted_val = getattr(row, "granted", None) if not isinstance(row, dict) else row.get("granted")
		if source_val == "Social Media" and bool(granted_val):
			has_social_scope = True
			break

	if not has_social_scope:
		frappe.throw(
			_("Scope 'Social Media' was not granted by the candidate."),
			SocialConsentError,
		)

	# 3. Akun spesifik dicentang
	if not account:
		frappe.throw(_("Account reference is required for social consent."), SocialConsentError)

	social_consent = getattr(account, "social_consent", None)
	if social_consent is None and isinstance(account, dict):
		social_consent = account.get("social_consent")
	if not bool(social_consent):
		platform_name = getattr(account, "platform", "") or (account.get("platform", "") if isinstance(account, dict) else "")
		username = getattr(account, "username", "") or (account.get("username", "") if isinstance(account, dict) else "")
		label = f"{platform_name} (@{username})" if username else (platform_name or "account")
		frappe.throw(
			_("Candidate did not consent to screening for account {0}.").format(label),
			SocialConsentError,
		)

	# 4. Domain platform akun diizinkan (tidak diblokir di Background Check Settings)
	from hris_ats.bgc.fetch import get_domain
	if blocked_domains is None:
		if getattr(frappe, "local", None) and getattr(frappe.local, "site", None):
			try:
				settings = frappe.get_single("Background Check Settings")
				blocked_domains = [
					line.strip().lower()
					for line in (settings.fetch_blocked_domains or "").splitlines()
					if line.strip()
				]
			except Exception:
				blocked_domains = []
		else:
			blocked_domains = []

	profile_url = getattr(account, "profile_url", None)
	if not profile_url and isinstance(account, dict):
		profile_url = account.get("profile_url")

	platform = getattr(account, "platform", None) or (account.get("platform", "") if isinstance(account, dict) else "")
	if not profile_url and platform:
		if getattr(frappe, "db", None) and getattr(frappe.local, "site", None):
			tmpl = frappe.db.get_value("Background Check Platform", platform, "profile_url_template")
		else:
			tmpl = None
		clean_user = (getattr(account, "username", "") or (account.get("username", "") if isinstance(account, dict) else "")).strip().lstrip("@")
		if tmpl and clean_user:
			profile_url = tmpl.replace("{username}", clean_user)

	if profile_url:
		dom = get_domain(profile_url)
		if any(dom == bd or dom.endswith("." + bd) for bd in blocked_domains):
			frappe.throw(
				_("Domain '{0}' is currently blocked in Background Check Settings.").format(dom),
				SocialConsentError,
			)

	return True


