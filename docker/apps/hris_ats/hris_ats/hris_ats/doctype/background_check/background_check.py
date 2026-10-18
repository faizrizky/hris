# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import secrets
from datetime import datetime, timedelta
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime, getdate, nowdate


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
