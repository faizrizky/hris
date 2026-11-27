# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe

PLATFORM_CRAWLER_CONFIG = {
	"Instagram": {
		"login_url": "https://www.instagram.com/accounts/login/",
		"session_domains": ".instagram.com\ninstagram.com",
	},
	"Facebook": {
		"login_url": "https://www.facebook.com/login/",
		"session_domains": ".facebook.com\nfacebook.com",
	},
	"TikTok": {
		"login_url": "https://www.tiktok.com/login",
		"session_domains": ".tiktok.com\ntiktok.com",
	},
	"LinkedIn": {
		"login_url": "https://www.linkedin.com/login",
		"session_domains": ".linkedin.com\nlinkedin.com",
	},
}


def execute():
	"""Idempotently populates login_url and session_domains on default social platforms."""
	if not frappe.db.exists("DocType", "Background Check Platform"):
		return

	for platform_name, cfg in PLATFORM_CRAWLER_CONFIG.items():
		if frappe.db.exists("Background Check Platform", platform_name):
			doc = frappe.get_doc("Background Check Platform", platform_name)
			changed = False
			if not doc.login_url or doc.login_url != cfg["login_url"]:
				doc.login_url = cfg["login_url"]
				changed = True
			if not doc.session_domains or doc.session_domains != cfg["session_domains"]:
				doc.session_domains = cfg["session_domains"]
				changed = True
			if changed:
				doc.flags.ignore_permissions = True
				doc.flags.ignore_mandatory = True
				doc.save()
