# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import secrets
from datetime import datetime, timedelta
from typing import Any

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, now_datetime, nowdate

from hris_ats.bgc.analysis.risk import calculate_risk_level
from hris_ats.i18n import render


class BackgroundCheck(Document):
	def before_insert(self):
		# Inisialisasi 6 sumber default di consent_scope dan source_runs
		default_sources = ["Platform", "Article", "File", "Case history", "Posts", "Social Media"]
		if not self.consent_scope:
			for src in default_sources:
				self.append("consent_scope", {"source": src, "granted": 1})

		if not self.source_runs:
			for src in default_sources:
				self.append("source_runs", {"source": src, "status": "Pending", "items_found": 0, "accounts_skipped": 0})

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
			self.skck_status = "Expired"

		# Jalur alternatif unggah dokumen persetujuan oleh HR
		if self.consent_method == "Uploaded document":
			if self.consent_file:
				if self.consent_status in ("Pending", None):
					self.consent_status = "Granted"
					self.consent_at = now_datetime()
					self.consent_ip = "uploaded_by_hr"
			elif self.consent_status == "Granted":
				frappe.throw(
					_("Signed consent document (consent_file) is mandatory when consent_method is 'Uploaded document'."),
					title=_("Consent File Mandatory"),
				)

			# Validasi konfirmasi per akun pada jalur dokumen
			for acc in self.accounts:
				if acc.social_consent:
					if not self.consent_file:
						frappe.throw(
							_("Attachment of consent_file is mandatory before social media consent can be granted for accounts."),
							title=_("Consent File Mandatory"),
						)
					if not acc.social_consent_attested_by:
						acc.social_consent_attested_by = getattr(frappe.session, "user", None) or "Administrator"
						acc.social_consent_attested_on = now_datetime()
				else:
					acc.social_consent_attested_by = None
					acc.social_consent_attested_on = None
		elif self.consent_method == "Web form":
			if self.consent_status in ("Pending", None):
				for acc in self.accounts:
					if acc.social_consent:
						acc.social_consent = 0
						acc.social_consent_attested_by = None
						acc.social_consent_attested_on = None
		else:
			for acc in self.accounts:
				if acc.social_consent and not acc.social_consent_attested_by:
					if not self.consent_file:
						frappe.throw(
							_("Attachment of consent_file is mandatory before social media consent can be granted for accounts."),
							title=_("Consent File Mandatory"),
						)

		if self.consent_status == "Withdrawn":
			for acc in self.accounts:
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

		if self.consent_status == "Granted" and self.status == "Waiting Consent":
			self.status = "Queued"

		for acc in self.accounts:
			if not getattr(acc, "profile_url", None) and getattr(acc, "platform", None) and getattr(acc, "username", None):
				if frappe.db.exists("Background Check Platform", acc.platform):
					tmpl = frappe.db.get_value("Background Check Platform", acc.platform, "profile_url_template")
					if tmpl:
						acc.profile_url = tmpl.replace("{username}", acc.username.strip().lstrip("@"))

	def on_update(self):
		# Penarikan persetujuan -> Hapus semua temuan (Finding), folder crawl, dan cache Redis
		if self.consent_status == "Withdrawn":
			frappe.db.delete("Background Check Finding", {"background_check": self.name})
			from hris_ats.bgc.consent import clean_bgc_cache, clean_bgc_crawldir
			clean_bgc_crawldir(self.name)
			clean_bgc_cache(self)

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
		frappe.throw(_("Finding {0} not found.").format(finding_name))

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
			"file_type", "match_confidence", "match_reasons", "match_reasons_template", "match_reasons_params",
			"category", "risk_flags", "risk_flags_template", "risk_flags_params", "severity",
			"case_type", "case_number", "court",
			"party_role", "hr_verdict", "hr_note", "published_on",
			"text_source", "evidence_excerpt", "detail_url", "pdf_url"
		],
		order_by="match_confidence desc, creation desc",
	)

	post_findings = frappe.get_all(
		"Background Check Finding",
		filters={"background_check": bgc_name, "finding_type": "Post"},
		fields=[
			"name", "finding_type", "title", "snippet", "url", "source_name", "account",
			"match_confidence", "category", "risk_flags", "risk_flags_template", "risk_flags_params",
			"severity", "hr_verdict", "hr_note", "published_on", "provenance", "media_type"
		],
		order_by="creation desc",
	)

	comment_findings = frappe.get_all(
		"Background Check Finding",
		filters={"background_check": bgc_name, "finding_type": "Comment"},
		fields=[
			"name", "finding_type", "title", "snippet", "url", "source_name", "account",
			"match_confidence", "category", "risk_flags", "risk_flags_template", "risk_flags_params",
			"severity", "hr_verdict", "hr_note", "published_on", "provenance", "media_type"
		],
		order_by="creation desc",
	)

	for f in name_findings:
		if f.get("match_reasons_template"):
			f["match_reasons"] = render(f["match_reasons_template"], f.get("match_reasons_params"))
		if f.get("risk_flags_template"):
			f["risk_flags"] = render(f["risk_flags_template"], f.get("risk_flags_params"))

	for p in post_findings:
		if p.get("risk_flags_template"):
			p["risk_flags"] = render(p["risk_flags_template"], p.get("risk_flags_params"))

	for c in comment_findings:
		if c.get("risk_flags_template"):
			c["risk_flags"] = render(c["risk_flags_template"], c.get("risk_flags_params"))

	return {
		"name_findings": name_findings,
		"post_findings": post_findings,
		"comment_findings": comment_findings,
	}


@frappe.whitelist()
def rerun_background_check(bgc_name: str) -> dict[str, Any]:
	"""HR memicu eksekusi ulang Background Check."""
	if not frappe.db.exists("Background Check", bgc_name):
		frappe.throw(_("Document {0} not found.").format(bgc_name))

	bgc = frappe.get_doc("Background Check", bgc_name)
	if bgc.consent_status != "Granted":
		frappe.throw(_("Background Check cannot run without candidate consent (current status: {0}).").format(bgc.consent_status))

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

	return {"message": _("Background Check rerun scheduled successfully."), "name": bgc.name}
