# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class BackgroundCheckCrawlerAccount(Document):
	def before_save(self):
		# The session is only written by save_crawler_storage_state(); a normal form save sends an
		# empty/masked value that would otherwise make Frappe delete the encrypted session.
		if not self.flags.allow_session_update:
			self.flags.ignore_save_passwords = ["session"]

	def validate(self):
		self.validate_single_active_per_platform()
		self.validate_risk_acknowledgment()
		self.validate_status_on_enable_toggle()
		self.validate_crawler_limits()

	def validate_crawler_limits(self):
		if self.hourly_limit is not None and self.hourly_limit < 1:
			frappe.throw(_("Hourly limit must be at least 1."))
		if self.daily_limit is not None and self.daily_limit < 1:
			frappe.throw(_("Daily limit must be at least 1."))
		if self.min_delay_seconds is not None and self.min_delay_seconds < 0:
			frappe.throw(_("Min delay seconds must be at least 0."))
		if self.jitter_seconds is not None and self.jitter_seconds < 0:
			frappe.throw(_("Jitter seconds must be at least 0."))

	def validate_single_active_per_platform(self):
		if not bool(self.enabled):
			return

		existing = frappe.db.get_value(
			"Background Check Crawler Account",
			{"platform": self.platform, "enabled": 1, "name": ["!=", self.name or ""]},
			"name",
		)
		if existing:
			frappe.throw(
				_("Only one active crawler account is allowed per platform ({0}). Existing active account: {1}").format(
					self.platform, existing
				),
				title=_("Duplicate Active Account"),
			)

	def validate_risk_acknowledgment(self):
		if self.risk_acknowledged:
			if not self.risk_ack_by or self.has_value_changed("risk_acknowledged"):
				self.risk_ack_by = getattr(frappe.session, "user", None) or "Administrator"
				self.risk_ack_on = now_datetime()
		else:
			self.risk_ack_by = None
			self.risk_ack_on = None

	def validate_status_on_enable_toggle(self):
		if not bool(self.enabled):
			if self.status == "Connected":
				self.status = "Disabled"
		else:
			if self.status == "Disabled":
				self.status = "Connected" if self.get_password("session") else "Not connected"

	def as_dict(self, *args, **kwargs):
		d = super().as_dict(*args, **kwargs)
		# Ensure session payload is never exposed in serialized dicts
		if "session" in d:
			d["session"] = None
		return d

	def disconnect(self):
		"""Clears stored session and resets status to Not connected."""
		from frappe.utils.password import remove_encrypted_password

		try:
			remove_encrypted_password("Background Check Crawler Account", self.name, fieldname="session")
		except Exception:
			pass
		self.session = None
		self.flags.allow_session_update = True
		self.status = "Not connected"
		self.connected_by = None
		self.connected_on = None
		self.session_expires_on = None
		self.last_error = None
		self.last_error_template = None
		self.last_error_params = None
		self.save(ignore_permissions=True)
