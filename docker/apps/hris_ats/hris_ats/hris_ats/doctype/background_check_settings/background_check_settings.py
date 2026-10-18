# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


def get_scrapling_browser_status() -> str:
	"""Cek status instalasi browser Scrapling langsung dari package Scrapling / patchright."""
	try:
		from scrapling.cli import __PACKAGE_DIR__

		if __PACKAGE_DIR__.joinpath(".scrapling_dependencies_installed").exists():
			return "Terpasang"
	except Exception:
		pass

	try:
		import os
		from patchright.sync_api import sync_playwright

		with sync_playwright() as p:
			if os.path.exists(p.chromium.executable_path):
				return "Terpasang"
	except Exception:
		pass

	return "Tidak terpasang"


class BackgroundCheckSettings(Document):
	def onload(self):
		self.fetch_browser_status = get_scrapling_browser_status()
		if not self.fetch_user_agent:
			self.fetch_user_agent = self.get_default_user_agent()

	def validate(self):
		self.fetch_browser_status = get_scrapling_browser_status()
		if not self.fetch_user_agent:
			self.fetch_user_agent = self.get_default_user_agent()

		self.validate_risk_acknowledgment()

	def get_default_user_agent(self) -> str:
		company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
			"Global Defaults", "default_company"
		)
		if company:
			return f"{company} HR Background Check (+hr@example.com)"
		return "HRIS Background Check (+hr@example.com)"

	def validate_risk_acknowledgment(self):
		is_risky = (
			not bool(self.fetch_respect_robots)
			or self.fetch_identity == "Browser"
			or bool(self.fetch_stealth_mode)
		)

		if is_risky and not bool(self.fetch_risk_acknowledged):
			frappe.throw(
				_(
					"Menyimpan pengaturan dengan mengabaikan robots.txt, identitas Browser, atau mode stealth "
					"ditolak tanpa konfirmasi pengakuan risiko (fetch_risk_acknowledged)."
				),
				title=_("Pengakuan Risiko Diperlukan"),
			)

		if self.fetch_risk_acknowledged:
			if not self.fetch_risk_ack_by or self.has_value_changed("fetch_risk_acknowledged"):
				self.fetch_risk_ack_by = getattr(frappe.session, "user", None) or "Administrator"
				self.fetch_risk_ack_on = frappe.utils.now_datetime()
		else:
			self.fetch_risk_ack_by = None
			self.fetch_risk_ack_on = None
