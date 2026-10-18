# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations
import frappe
from frappe import _
from frappe.utils import now_datetime

no_cache = 1


def get_context(context):
	context.no_breadcrumbs = True
	token = frappe.form_dict.get("token")
	if not token:
		context.error = _("Tautan tidak valid atau token tidak disertakan.")
		return

	bgc_name = frappe.db.get_value("Background Check", {"consent_token": token}, "name")
	if not bgc_name:
		context.error = _("Tautan persetujuan tidak valid atau sudah pernah digunakan.")
		return

	bgc = frappe.get_doc("Background Check", bgc_name)
	if bgc.consent_token_expires_at and bgc.consent_token_expires_at < now_datetime():
		context.error = _("Tautan persetujuan telah kedaluwarsa. Silakan hubungi tim HR.")
		return

	if bgc.consent_status != "Pending":
		context.error = _("Persetujuan untuk berkas ini sudah pernah diproses sebelumnya.")
		return

	settings = frappe.get_single("Background Check Settings")
	context.bgc = bgc
	context.token = token
	context.applicant_name = bgc.full_name
	context.consent_text = settings.consent_text or ""
	context.retention_days = settings.retention_days or 90
	context.platforms = frappe.get_all(
		"Background Check Platform",
		filters={"enabled": 1},
		fields=["platform_name", "category"],
		order_by="platform_name asc",
	)
	context.sources = [
		{"key": "Platform", "label": "Pemeriksaan Akun & Platform Publik", "desc": "Pengecekan profil publik pada akun media sosial/profesional yang Anda nyatakan."},
		{"key": "Article", "label": "Pemberitaan & Publikasi Media", "desc": "Pencarian artikel publik terkait rekam jejak profesional dan prestasi."},
		{"key": "File", "label": "Dokumen & Publikasi Terbuka", "desc": "Pencarian berkas atau publikasi karya ilmiah publik."},
		{"key": "Case history", "label": "Riwayat Perkara Hukum (Putusan MA)", "desc": "Pemeriksaan direktori putusan pengadilan terbuka untuk verifikasi integritas hukum."},
		{"key": "Posts", "label": "Aktivitas Akun Publik", "desc": "Pemeriksaan kesantunan bahasa dan konten berisiko pada platform dengan API resmi."},
	]
