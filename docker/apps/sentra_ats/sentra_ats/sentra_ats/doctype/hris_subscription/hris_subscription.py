# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import nowdate

from sentra_ats.subscription import SITE_RE, compute_status, site_exists, sync_one


class HRISSubscription(Document):
	def validate(self):
		self.site = (self.site or "").strip().lower()
		self.code = (self.code or "").strip()
		if not SITE_RE.match(self.site):
			frappe.throw(_("Site must look like client-a.localhost."))
		if frappe.conf.get("hris_control_plane"):
			if self.site == frappe.local.site:
				frappe.throw(_("The control-plane site cannot be locked."))
			if not site_exists(self.site):
				frappe.throw(_("Site {0} does not exist on this server.").format(self.site))
		self.status = compute_status(self.enabled, self.valid_until, nowdate())

	def on_update(self):
		if frappe.conf.get("hris_control_plane"):  # client sites only hold the pushed copy
			frappe.enqueue(sync_one, subscription=self.name, queue="short", enqueue_after_commit=True)
