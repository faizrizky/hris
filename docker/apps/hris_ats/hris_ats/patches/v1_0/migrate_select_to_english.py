# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import frappe

DEFAULT_CONSENT_TEXT_ID = (
	"Dengan memberikan persetujuan ini, saya mengizinkan verifikasi informasi profil publik, "
	"riwayat perkara publik, dan akun media sosial yang saya nyatakan untuk keperluan seleksi kerja "
	"sesuai ketentuan UU PDP."
)

DEFAULT_CONSENT_TEXT_EN = (
	"By granting this consent, I authorize the verification of my declared public profile information, "
	"public case history, and social media accounts for recruitment purposes in accordance with "
	"applicable personal data protection laws."
)


def execute():
	"""Migrates Indonesian Select values to standard English values across existing records.

	Idempotent: Safe to execute multiple times.
	"""
	# 1. Background Check Select values
	bgc_risk_map = {
		"Rendah": "Low",
		"Sedang": "Medium",
		"Tinggi": "High",
		"Perlu verifikasi": "Needs verification",
	}
	for id_val, en_val in bgc_risk_map.items():
		frappe.db.sql(
			"UPDATE `tabBackground Check` SET risk_level_auto = %s WHERE risk_level_auto = %s",
			(en_val, id_val),
		)
		frappe.db.sql(
			"UPDATE `tabBackground Check` SET risk_level_final = %s WHERE risk_level_final = %s",
			(en_val, id_val),
		)

	skck_map = {
		"Tidak diunggah": "Not uploaded",
		"Belum diperiksa": "Not checked",
		"Bersih": "Clear",
		"Ada catatan": "Has records",
		"Kedaluwarsa": "Expired",
	}
	for id_val, en_val in skck_map.items():
		frappe.db.sql(
			"UPDATE `tabBackground Check` SET skck_status = %s WHERE skck_status = %s",
			(en_val, id_val),
		)

	# 2. Background Check Finding
	finding_cat_map = {
		"Prestasi": "Achievement",
		"Profesional": "Professional",
		"Netral": "Neutral",
		"Berisiko": "Risky",
	}
	for id_val, en_val in finding_cat_map.items():
		frappe.db.sql(
			"UPDATE `tabBackground Check Finding` SET category = %s WHERE category = %s",
			(en_val, id_val),
		)

	finding_sev_map = {
		"Rendah": "Low",
		"Sedang": "Medium",
		"Tinggi": "High",
	}
	for id_val, en_val in finding_sev_map.items():
		frappe.db.sql(
			"UPDATE `tabBackground Check Finding` SET severity = %s WHERE severity = %s",
			(en_val, id_val),
		)

	finding_verdict_map = {
		"Belum ditinjau": "Not reviewed",
		"Relevan": "Relevant",
		"Bukan orang ini": "Not this person",
		"Diabaikan": "Ignored",
	}
	for id_val, en_val in finding_verdict_map.items():
		frappe.db.sql(
			"UPDATE `tabBackground Check Finding` SET hr_verdict = %s WHERE hr_verdict = %s",
			(en_val, id_val),
		)

	text_source_map = {
		"Cuplikan": "Snippet",
		"Teks lengkap": "Full text",
		"PDF putusan": "Decision PDF",
	}
	for id_val, en_val in text_source_map.items():
		frappe.db.sql(
			"UPDATE `tabBackground Check Finding` SET text_source = %s WHERE text_source = %s",
			(en_val, id_val),
		)

	# 3. Background Check Lexicon
	lexicon_cat_map = {
		"Kata kasar": "Profanity",
		"Ujaran kebencian/SARA": "Hate speech",
		"Ancaman/kekerasan": "Threats/violence",
		"Pornografi": "Pornography",
		"Judi online": "Online gambling",
		"Narkoba": "Narcotics",
		"Penipuan": "Fraud",
		"Kebocoran informasi perusahaan": "Company information leak",
		"Hukum-negatif": "Legal-negative",
		"Prestasi": "Achievement",
		"Profesional": "Professional",
	}
	for id_val, en_val in lexicon_cat_map.items():
		frappe.db.sql(
			"UPDATE `tabBackground Check Lexicon` SET category = %s WHERE category = %s",
			(en_val, id_val),
		)
	for id_val, en_val in finding_sev_map.items():
		frappe.db.sql(
			"UPDATE `tabBackground Check Lexicon` SET severity = %s WHERE severity = %s",
			(en_val, id_val),
		)

	# 4. Job Applicant custom field bgc_risk_level
	if frappe.db.has_column("Job Applicant", "bgc_risk_level"):
		for id_val, en_val in bgc_risk_map.items():
			frappe.db.sql(
				"UPDATE `tabJob Applicant` SET bgc_risk_level = %s WHERE bgc_risk_level = %s",
				(en_val, id_val),
			)

	# 5. Background Check Settings consent text ID / EN
	if frappe.db.exists("DocType", "Background Check Settings"):
		settings = frappe.get_single("Background Check Settings")
		dirty = False

		# Copy old consent_text if consent_text_id is empty
		if not settings.get("consent_text_id"):
			old_text = settings.get("consent_text") or DEFAULT_CONSENT_TEXT_ID
			settings.consent_text_id = old_text
			dirty = True

		if not settings.get("consent_text_en"):
			settings.consent_text_en = DEFAULT_CONSENT_TEXT_EN
			dirty = True

		if dirty:
			settings.flags.ignore_permissions = True
			settings.save()
