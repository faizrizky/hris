# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

"""Pemrosesan berkas ekspor data resmi kandidat (Spesifikasi 5.3 & Fase 4).
Menerima berkas arsip, memvalidasi keamanan, mengurai post dan komentar milik kandidat,
menerapkan analisis leksikon & kesantunan, dan menyimpan ke Background Check Finding.
"""

from __future__ import annotations

import base64
import json
import os
import tempfile
from typing import Any

import frappe
from frappe import _
from frappe.utils import now_datetime

from hris_ats.bgc.analysis.identity import calculate_account_identity_match
from hris_ats.bgc.analysis.posts import analyze_posts
from hris_ats.bgc.analysis.risk import calculate_risk_level
from hris_ats.bgc.analysis.summary import generate_automated_summary
from hris_ats.bgc.consent import assert_social_consent
from hris_ats.bgc.export_parsers import (
	ArchiveSizeExceededError,
	ExportSecurityError,
	ZipBombError,
	ZipSlipError,
	parse_candidate_export,
	safe_extract_export_archive,
)
from hris_ats.bgc.fetch import get_fetch_config_from_settings, is_forbidden_domain
from hris_ats.bgc.providers.base import FindingData


def process_candidate_export_data(
	bgc_name: str,
	platform: str,
	username: str,
	archive_bytes: bytes,
) -> dict[str, Any]:
	"""Memproses data ekspor kandidat dalam memori dan menyimpan Finding serta memperbarui akun."""
	bgc = frappe.get_doc("Background Check", bgc_name)
	settings = frappe.get_single("Background Check Settings")

	max_mb = int(getattr(settings, "export_max_mb", None) or 100)
	max_posts = int(getattr(settings, "social_max_posts", None) or 200)
	max_comments = int(getattr(settings, "social_max_comments", None) or 200)
	lookback_months = int(getattr(settings, "social_lookback_months", None) or 12)

	# 1. Cari baris akun di Background Check
	acc_row = None
	for a in bgc.accounts:
		if a.platform.lower() == platform.lower() and a.username.lower().lstrip("@") == username.lower().lstrip("@"):
			acc_row = a
			break

	if not acc_row:
		# Jika akun belum tercatat, buat baris baru
		acc_row = bgc.append("accounts", {
			"platform": platform,
			"username": username.strip().lstrip("@"),
			"declared_by": "Candidate",
			"social_consent": 1,
			"connection_method": "Data export",
		})
		bgc.save(ignore_permissions=True)
	else:
		acc_row.connection_method = "Data export"

	# 2. Penjaga Persetujuan Terpusat (Spesifikasi 3.1 & 3b)
	fetch_cfg = get_fetch_config_from_settings()
	assert_social_consent(bgc, acc_row, blocked_domains=fetch_cfg.blocked_domains)

	# 3. Ekstraksi arsip secara aman dalam direktori sementara
	import shutil
	temp_dir = tempfile.mkdtemp(prefix="bgc_export_")
	try:
		try:
			extracted_files = safe_extract_export_archive(archive_bytes, max_size_mb=max_mb)
		except ZipSlipError:
			frappe.throw(_("Potential zip-slip path traversal detected in archive."), title=_("Security Error"))
		except ZipBombError:
			frappe.throw(_("Zip-bomb compression ratio or uncompressed size limit exceeded."), title=_("Security Error"))
		except ArchiveSizeExceededError:
			frappe.throw(_("Archive file size exceeds maximum limit of {0} MB.").format(max_mb), title=_("Size Limit Exceeded"))
		except Exception as e:
			frappe.throw(str(e), title=_("Export Processing Error"))

		# 4. Urai dengan parser platform (fungsi murni)
		try:
			parsed = parse_candidate_export(
				platform=platform,
				files=extracted_files,
				username=username,
				lookback_months=lookback_months,
				max_posts=max_posts,
				max_comments=max_comments,
			)
		except ValueError:
			frappe.throw(_("Invalid or unrecognized export archive format for {0}.").format(platform), title=_("Invalid Format"))
		except Exception as e:
			frappe.throw(str(e), title=_("Parsing Error"))
	finally:
		if os.path.exists(temp_dir):
			shutil.rmtree(temp_dir, ignore_errors=True)

	# Update profil akun
	prof = parsed.get("profile", {})
	if prof.get("display_name"):
		acc_row.display_name = prof["display_name"]
	acc_row.exists = 1

	name_variants = [v.strip() for v in (bgc.name_variants or "").split("\n") if v.strip()]
	id_match, id_reasons = calculate_account_identity_match(
		candidate_name=bgc.full_name,
		candidate_variants=name_variants,
		candidate_city="",
		candidate_cv_terms=[],
		display_name=acc_row.display_name,
		bio="",
		location="",
		declared_by_candidate=True,
	)
	acc_row.identity_match = id_match
	acc_row.identity_reasons = "\n".join(id_reasons)
	acc_row.identity_reasons_template = "\n".join(id_reasons)
	acc_row.identity_reasons_params = "{}"

	# 5. Siapkan leksikon dan jalankan analisis
	lexicon_records = frappe.get_all(
		"Background Check Lexicon",
		filters={"enabled": 1},
		fields=["category", "term", "is_regex", "severity", "weight", "enabled"],
	)

	posts_for_analysis = [
		{"text": p["snippet"], "created_at": p.get("published_on"), "url": p.get("url", ""), "is_reply": False}
		for p in parsed.get("posts", [])
	]
	comments_for_analysis = [
		{"text": c["snippet"], "created_at": c.get("published_on"), "url": c.get("url", ""), "is_reply": True}
		for c in parsed.get("comments", [])
	]
	all_for_analysis = posts_for_analysis + comments_for_analysis

	p_analysis = analyze_posts(
		posts=all_for_analysis,
		lexicon_items=lexicon_records,
		preferred_skills=[],
		required_skills=[],
	)

	risk_by_text = {}
	for rp in p_analysis.get("risk_posts", []):
		risk_by_text[rp.get("text", "")[:100]] = rp

	# 6. Simpan Finding Post & Comment
	findings_to_insert = []
	for p in parsed.get("posts", []):
		snippet = p["snippet"]
		rp = risk_by_text.get(snippet[:100])
		sev = rp.get("severity", "Low") if rp else "Low"
		cat = "Risky" if rp else "Neutral"
		r_flags = rp.get("risk_flags", "") if rp else ""

		title = "Candidate Export Post Flagged as Risky" if rp else f"Candidate Export Post on {platform}"
		findings_to_insert.append(FindingData(
			finding_type="Post",
			title=title,
			snippet=snippet,
			url=p.get("url", ""),
			severity=sev,
			category=cat,
			risk_flags=r_flags,
			risk_flags_template=r_flags,
			risk_flags_params="{}",
			match_confidence=100,
			provenance="Candidate export",
			media_type=p.get("media_type", "Text"),
			account=acc_row.name or "",
			published_on=p.get("published_on"),
		))

	for c in parsed.get("comments", []):
		snippet = c["snippet"]
		rp = risk_by_text.get(snippet[:100])
		sev = rp.get("severity", "Low") if rp else "Low"
		cat = "Risky" if rp else "Neutral"
		r_flags = rp.get("risk_flags", "") if rp else ""

		title = "Candidate Export Comment Flagged as Risky" if rp else f"Candidate Export Comment on {platform}"
		findings_to_insert.append(FindingData(
			finding_type="Comment",
			title=title,
			snippet=snippet,
			url=c.get("url", ""),
			severity=sev,
			category=cat,
			risk_flags=r_flags,
			risk_flags_template=r_flags,
			risk_flags_params="{}",
			match_confidence=100,
			provenance="Candidate export",
			media_type="Text",
			account=acc_row.name or "",
			published_on=c.get("published_on"),
		))

	# Simpan temuan baru ke database
	for f in findings_to_insert:
		doc_dict = {
			"doctype": "Background Check Finding",
			"background_check": bgc.name,
			"finding_type": f.finding_type,
			"title": f.title,
			"snippet": f.snippet,
			"url": f.url,
			"source_name": "Social Media",
			"published_on": f.published_on,
			"file_type": f.file_type,
			"match_confidence": f.match_confidence,
			"match_reasons": f.match_reasons,
			"match_reasons_template": f.match_reasons_template,
			"match_reasons_params": f.match_reasons_params,
			"category": f.category,
			"risk_flags": f.risk_flags,
			"risk_flags_template": f.risk_flags_template,
			"risk_flags_params": f.risk_flags_params,
			"severity": f.severity,
			"account": acc_row.name or f.account,
			"provenance": f.provenance,
			"media_type": f.media_type,
			"text_source": "Candidate export",
			"hr_verdict": "Not reviewed",
		}
		new_f = frappe.get_doc(doc_dict)
		new_f.insert(ignore_permissions=True)

	# Update status Source Run
	sr_row = None
	for sr in bgc.source_runs:
		if sr.source == "Social Media":
			sr_row = sr
			break
	if not sr_row:
		sr_row = bgc.append("source_runs", {
			"source": "Social Media",
			"status": "Done",
			"started_on": now_datetime(),
			"finished_on": now_datetime(),
		})
	sr_row.status = "Done"
	sr_row.items_found = (sr_row.items_found or 0) + len(findings_to_insert)
	sr_row.fetch_mode_used = "export"
	sr_row.finished_on = now_datetime()

	# Hitung ulang ringkasan dan risk level
	all_findings_raw = frappe.get_all(
		"Background Check Finding",
		filters={"background_check": bgc.name},
		fields=["finding_type", "severity", "match_confidence", "hr_verdict", "category"],
	)
	calculated_risk = calculate_risk_level(all_findings_raw, politeness_score=p_analysis.get("politeness_score", 100))
	bgc.risk_level_auto = calculated_risk

	job_title = ""
	if bgc.job_applicant:
		job_title = frappe.db.get_value("Job Applicant", bgc.job_applicant, "job_title") or ""
		if job_title and frappe.db.exists("Job Opening", job_title):
			job_title = frappe.db.get_value("Job Opening", job_title, "job_title") or job_title

	account_platforms = [a.platform for a in bgc.accounts if a.platform]
	article_count = frappe.db.count("Background Check Finding", {"background_check": bgc.name, "finding_type": "Article"})
	achievement_count = frappe.db.count(
		"Background Check Finding",
		{"background_check": bgc.name, "finding_type": "Article", "category": ["in", ["Achievement", "Prestasi"]]},
	)
	case_count = frappe.db.count("Background Check Finding", {"background_check": bgc.name, "finding_type": "Case"})
	risk_posts_count = len([f for f in all_findings_raw if f.finding_type in ("Post", "Comment") and f.category == "Risky"])

	summary_text = generate_automated_summary(
		candidate_name=bgc.full_name,
		job_title=job_title,
		accounts=account_platforms,
		article_count=article_count,
		achievement_count=achievement_count,
		case_count=case_count,
		posts_count=len(all_for_analysis),
		politeness_score=p_analysis.get("politeness_score", 100),
		risk_posts_count=risk_posts_count,
	)
	bgc.summary_auto = str(summary_text)
	bgc.summary_auto_template = getattr(summary_text, "template", str(summary_text))
	bgc.summary_auto_params = json.dumps(getattr(summary_text, "params", {}))

	bgc.save(ignore_permissions=True)

	return {
		"status": "Success",
		"posts_saved": len(parsed.get("posts", [])),
		"comments_saved": len(parsed.get("comments", [])),
		"politeness_score": p_analysis.get("politeness_score", 100),
		"account": acc_row.name,
	}


@frappe.whitelist()
def upload_candidate_export(
	token: str,
	platform: str,
	username: str,
	file_content_base64: str | None = None,
	archive_bytes: bytes | None = None,
) -> dict[str, Any]:
	"""API endpoint menerima unggahan arsip ekspor data resmi kandidat dari halaman persetujuan."""
	if not token:
		frappe.throw(_("Consent token is invalid or missing."))

	bgc_name = frappe.db.get_value("Background Check", {"consent_token": token}, "name")
	if not bgc_name:
		frappe.throw(_("Consent token is invalid or has already been used."))

	bgc = frappe.get_doc("Background Check", bgc_name)
	if bgc.consent_token_expires_at and bgc.consent_token_expires_at < now_datetime():
		frappe.throw(_("Consent link has expired. Please contact the HR team."))

	# Never grant consent as a side effect of an upload: the candidate must have submitted the
	# consent form (with Social Media scope) before any export data is processed.
	if bgc.consent_status != "Granted":
		frappe.throw(_("Consent has not been granted for this record."), frappe.PermissionError)
	if not any(row.source == "Social Media" and row.granted for row in bgc.consent_scope):
		frappe.throw(_("The candidate has not consented to Social Media analysis."), frappe.PermissionError)

	# Ambil berkas unggahan
	if not archive_bytes:
		if file_content_base64:
			archive_bytes = base64.b64decode(file_content_base64)
		else:
			req = getattr(frappe.local, "request", None)
			if req and hasattr(req, "files") and "export_file" in req.files:
				file_obj = req.files["export_file"]
				archive_bytes = file_obj.read()
			elif hasattr(frappe.local, "form_dict") and frappe.form_dict.get("file_content_base64"):
				archive_bytes = base64.b64decode(frappe.form_dict["file_content_base64"])

	if not archive_bytes:
		frappe.throw(_("Export data archive file is required."), title=_("Missing File"))

	res = process_candidate_export_data(
		bgc_name=bgc.name,
		platform=platform,
		username=username,
		archive_bytes=archive_bytes,
	)

	return {
		"message": _("Candidate export data successfully parsed and saved."),
		"result": res,
	}
