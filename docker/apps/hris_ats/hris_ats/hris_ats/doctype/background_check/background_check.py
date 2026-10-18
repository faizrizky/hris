# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import secrets
from datetime import datetime, timedelta
from typing import Any
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime, getdate, nowdate

from hris_ats.bgc.analysis.risk import calculate_risk_level


class BackgroundCheck(Document):
	def before_insert(self):
		# Inisialisasi 5 sumber default di consent_scope dan source_runs
		default_sources = ["Platform", "Article", "File", "Case history", "Posts"]
		if not self.consent_scope:
			for src in default_sources:
				self.append("consent_scope", {"source": src, "granted": 1})

		if not self.source_runs:
			for src in default_sources:
				self.append("source_runs", {"source": src, "status": "Pending", "items_found": 0})

		# Buat token persetujuan sekali pakai dengan kedaluwarsa 7 hari
		if not self.consent_token:
			self.consent_token = secrets.token_urlsafe(32)
			self.consent_token_expires_at = now_datetime() + timedelta(days=7)

		# Normalisasi nomor telepon ke format +62
		if self.phone:
			self.phone = self._normalize_phone(self.phone)

	def validate(self):
		# Validasi status SKCK kedaluwarsa
		if self.skck_valid_until and getdate(self.skck_valid_until) < getdate(nowdate()):
			self.skck_status = "Kedaluwarsa"

		# Jalur alternatif unggah dokumen persetujuan oleh HR
		if self.consent_method == "Uploaded document" and self.consent_file:
			if self.consent_status in ("Pending", None):
				self.consent_status = "Granted"
				self.consent_at = now_datetime()
				self.consent_ip = "uploaded_by_hr"

		if self.consent_status == "Granted" and self.status == "Waiting Consent":
			self.status = "Queued"

	def on_update(self):
		# Penarikan persetujuan -> Hapus semua temuan (Finding) milik dokumen ini
		if self.consent_status == "Withdrawn":
			frappe.db.delete("Background Check Finding", {"background_check": self.name})

		# Sinkronkan kesimpulan dan tingkat risiko ke Job Applicant
		if self.job_applicant and frappe.db.exists("Job Applicant", self.job_applicant):
			risk = self.risk_level_final or self.risk_level_auto
			if self.hr_conclusion or risk:
				frappe.db.set_value("Job Applicant", self.job_applicant, {
					"bgc_risk_level": risk,
					"bgc_conclusion": self.hr_conclusion,
				}, update_modified=False)

	@staticmethod
	def _normalize_phone(phone: str) -> str:
		clean = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
		if clean.startswith("0"):
			return "+62" + clean[1:]
		elif clean.startswith("62") and not clean.startswith("+62"):
			return "+" + clean
		elif not clean.startswith("+"):
			return "+62" + clean
		return clean


@frappe.whitelist()
def update_finding_verdict(finding_name: str, verdict: str, note: str = "") -> dict[str, Any]:
	"""Memperbarui HR verdict pada temuan dan menghitung ulang tingkat risiko otomatis."""
	if not frappe.db.exists("Background Check Finding", finding_name):
		frappe.throw(_("Temuan {0} tidak ditemukan.").format(finding_name))

	finding = frappe.get_doc("Background Check Finding", finding_name)
	finding.hr_verdict = verdict
	if note:
		finding.hr_note = note
	finding.save(ignore_permissions=True)

	bgc = frappe.get_doc("Background Check", finding.background_check)
	all_findings = frappe.get_all(
		"Background Check Finding",
		filters={"background_check": bgc.name},
		fields=["severity", "match_confidence", "hr_verdict", "category", "finding_type"],
	)
	settings = frappe.get_single("Background Check Settings")
	min_confidence = settings.min_match_confidence or 50
	new_risk = calculate_risk_level(
		findings=all_findings,
		politeness_score=bgc.politeness_score or 100,
		min_confidence=min_confidence,
	)
	bgc.risk_level_auto = new_risk
	bgc.save(ignore_permissions=True)

	return {
		"success": True,
		"new_risk": new_risk,
		"verdict": verdict,
	}


@frappe.whitelist()
def get_findings_data(bgc_name: str) -> dict[str, Any]:
	"""Mengambil data temuan terstruktur untuk dirender di tab form."""
	if not frappe.db.exists("Background Check", bgc_name):
		return {"name_findings": [], "post_findings": []}

	name_findings = frappe.get_all(
		"Background Check Finding",
		filters={"background_check": bgc_name, "finding_type": ["in", ["Article", "File", "Case"]]},
		fields=[
			"name", "finding_type", "title", "snippet", "url", "source_name",
			"file_type", "match_confidence", "match_reasons", "category",
			"risk_flags", "severity", "case_type", "case_number", "court",
			"party_role", "hr_verdict", "hr_note", "published_on"
		],
		order_by="match_confidence desc, creation desc",
	)

	post_findings = frappe.get_all(
		"Background Check Finding",
		filters={"background_check": bgc_name, "finding_type": "Post"},
		fields=[
			"name", "finding_type", "title", "snippet", "url", "source_name",
			"match_confidence", "category", "risk_flags", "severity",
			"hr_verdict", "hr_note", "published_on"
		],
		order_by="creation desc",
	)

	return {
		"name_findings": name_findings,
		"post_findings": post_findings,
	}


@frappe.whitelist()
def rerun_background_check(bgc_name: str) -> dict[str, Any]:
	"""HR memicu eksekusi ulang Background Check."""
	if not frappe.db.exists("Background Check", bgc_name):
		frappe.throw(_("Dokumen {0} tidak ditemukan.").format(bgc_name))

	bgc = frappe.get_doc("Background Check", bgc_name)
	if bgc.consent_status != "Granted":
		frappe.throw(_("Background Check tidak dapat dijalankan tanpa persetujuan kandidat (status saat ini: {0}).").format(bgc.consent_status))

	bgc.status = "Queued"
	for row in bgc.source_runs:
		row.status = "Pending"
		row.items_found = 0
		row.error = ""
	bgc.save(ignore_permissions=True)

	frappe.enqueue(
		"hris_ats.bgc.runner.run_all_sources",
		queue="long",
		bgc_name=bgc.name,
	)

	return {"message": _("Pemeriksaan ulang Background Check telah dijadwalkan."), "name": bgc.name}
