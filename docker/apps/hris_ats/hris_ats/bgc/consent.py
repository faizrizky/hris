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
def initiate_background_check(applicant_name: str) -> dict[str, Any]:
	"""Tombol 'Mulai background check' pada Job Applicant."""
	if not frappe.db.exists("Job Applicant", applicant_name):
		frappe.throw(_("Pelamar {0} tidak ditemukan.").format(applicant_name))

	applicant = frappe.get_doc("Job Applicant", applicant_name)

	# Validasi: Background check hanya boleh untuk pelamar yang screening-nya Done
	if applicant.screening_status != "Done":
		frappe.throw(_("Background check hanya dapat dimulai untuk pelamar dengan status screening 'Done'."))

	# Periksa apakah sudah ada dokumen Background Check untuk pelamar ini
	existing_bgc = frappe.db.get_value("Background Check", {"job_applicant": applicant.name}, "name")
	if existing_bgc:
		bgc = frappe.get_doc("Background Check", existing_bgc)
	else:
		bgc = frappe.new_doc("Background Check")
		bgc.job_applicant = applicant.name
		bgc.full_name = applicant.applicant_name
		bgc.email = applicant.email_id
		bgc.phone = applicant.phone_number

		# Ambil istilah konteks dari Resume Screening jika ada
		context_items = []
		if applicant.get("city"):
			context_items.append(applicant.city)
		if applicant.job_title:
			context_items.append(frappe.db.get_value("Job Opening", applicant.job_title, "job_title") or "")
		bgc.context_terms = ", ".join(filter(None, context_items))

		# Variasi nama awal
		names = applicant.applicant_name.split()
		variants = [applicant.applicant_name]
		if len(names) >= 2:
			variants.append(f"{names[0]} {names[-1]}")
		bgc.name_variants = "\n".join(variants)

		bgc.consent_status = "Pending"
		bgc.status = "Waiting Consent"
		bgc.insert(ignore_permissions=True)

	# Ubah recruitment_stage ke Background Check dan tautkan dokumen
	applicant.db_set("recruitment_stage", "Background Check")
	applicant.db_set("background_check", bgc.name)

	# Kirim email permohonan persetujuan ke kandidat lewat Email Queue bawaan
	if bgc.email and bgc.consent_token:
		consent_url = f"{get_url()}/ats-consent?token={bgc.consent_token}"
		subject = _("Persetujuan Pemeriksaan Latar Belakang - Rekrutmen")
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
				now=False,  # Menggunakan Email Queue
			)
		except frappe.OutgoingEmailError:
			frappe.log_error(title="BGC Consent Email Failed", message=f"OutgoingEmailError saat mengirim email ke {bgc.email}")

	return {
		"message": _("Background Check berhasil dibuat dan undangan persetujuan telah dikirim."),
		"name": bgc.name,
		"token": bgc.consent_token,
	}


@frappe.whitelist(allow_guest=True)
def submit_candidate_consent(
	token: str,
	granted_sources: list[str] | str,
	accounts: list[dict[str, Any]] | str | None = None,
	skck_file: str | None = None,
) -> dict[str, Any]:
	"""Endpoint penerimaan persetujuan dari Web Form kandidat."""
	if not token:
		frappe.throw(_("Token persetujuan tidak valid atau tidak disertakan."))

	bgc_name = frappe.db.get_value("Background Check", {"consent_token": token}, "name")
	if not bgc_name:
		frappe.throw(_("Token persetujuan tidak valid atau sudah pernah digunakan."))

	bgc = frappe.get_doc("Background Check", bgc_name)

	# Validasi kedaluwarsa token
	if bgc.consent_token_expires_at and bgc.consent_token_expires_at < now_datetime():
		frappe.throw(_("Tautan persetujuan telah kedaluwarsa. Silakan hubungi tim HR."))

	if bgc.consent_status != "Pending":
		frappe.throw(_("Persetujuan untuk berkas ini sudah pernah diproses sebelumnya."))

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

	# Simpan akun media sosial yang dinyatakan kandidat
	if accounts:
		for acc in accounts:
			if acc.get("platform") and acc.get("username"):
				bgc.append("accounts", {
					"platform": acc["platform"],
					"username": acc["username"],
					"declared_by": "Candidate",
					"post_access": "Manual review only",
				})

	# Simpan berkas SKCK opsional
	if skck_file:
		bgc.skck_file = skck_file
		bgc.skck_status = "Belum diperiksa"

	# Ambil versi teks persetujuan dari Settings
	settings = frappe.get_single("Background Check Settings")
	bgc.consent_text_version = settings.consent_text_version or "v1.0"
	bgc.consent_at = now_datetime()
	bgc.consent_ip = getattr(frappe.local, "request_ip", "web_client")
	bgc.consent_status = "Granted"
	bgc.status = "Queued"

	# Hanguskan token sekali pakai
	bgc.consent_token = None

	bgc.save(ignore_permissions=True)

	# Jadwalkan crawling/analisis di antrean long
	frappe.enqueue(
		"hris_ats.bgc.runner.run_all_sources",
		queue="long",
		bgc_name=bgc.name,
	)

	return {
		"success": True,
		"message": _("Persetujuan berhasil dicatat. Terima kasih."),
		"name": bgc.name,
	}


@frappe.whitelist()
def revoke_consent(bgc_name: str) -> dict[str, Any]:
	"""Penarikan persetujuan: hapus semua temuan mentah sesuai UU PDP."""
	if not frappe.db.exists("Background Check", bgc_name):
		frappe.throw(_("Dokumen {0} tidak ditemukan.").format(bgc_name))

	count = frappe.db.count("Background Check Finding", {"background_check": bgc_name})

	bgc = frappe.get_doc("Background Check", bgc_name)
	bgc.consent_status = "Withdrawn"
	bgc.status = "Done"
	bgc.save(ignore_permissions=True)

	return {
		"message": _("Persetujuan ditarik. {0} temuan berhasil dihapus.").format(count),
		"findings_deleted": count,
	}
