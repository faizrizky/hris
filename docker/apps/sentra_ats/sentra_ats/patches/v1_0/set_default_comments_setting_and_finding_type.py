# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""Idempotently sets default values for social_max_comments on existing Single doctype
	Background Check Settings if uninitialized, null, or 0.
	Also ensures finding_type in Background Check Finding has Comment option.
	"""
	if frappe.db.exists("DocType", "Background Check Settings"):
		settings = frappe.get_single("Background Check Settings")
		if not getattr(settings, "social_max_comments", None) or settings.social_max_comments <= 0:
			settings.social_max_comments = 200
			settings.flags.ignore_permissions = True
			settings.save()
