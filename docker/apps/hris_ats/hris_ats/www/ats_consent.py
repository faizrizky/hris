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
		context.error = _("Invalid link or missing consent token.")
		return

	bgc_name = frappe.db.get_value("Background Check", {"consent_token": token}, "name")
	if not bgc_name:
		context.error = _("Consent link is invalid or has already been used.")
		return

	bgc = frappe.get_doc("Background Check", bgc_name)
	if bgc.consent_token_expires_at and bgc.consent_token_expires_at < now_datetime():
		context.error = _("Consent link has expired. Please contact the HR team.")
		return

	if bgc.consent_status != "Pending":
		context.error = _("Consent for this record has already been processed.")
		return

	# Language resolution: ?lang= -> candidate_language (from token) -> Accept-Language -> default id
	# Only 'id' and 'en' are accepted. Other ?lang= values are ignored.
	url_lang = frappe.form_dict.get("lang")
	if url_lang in ("id", "en"):
		lang = url_lang
	elif getattr(bgc, "candidate_language", None) in ("id", "en"):
		lang = bgc.candidate_language
	elif hasattr(frappe.local, "request") and frappe.local.request:
		accept_lang = frappe.local.request.headers.get("Accept-Language", "")
		lang = "id"
		if accept_lang:
			for part in accept_lang.split(","):
				code = part.split(";")[0].strip().lower()
				if code.startswith("en"):
					lang = "en"
					break
				if code.startswith("id"):
					lang = "id"
					break
	else:
		lang = "id"

	frappe.local.lang = lang
	context.lang = lang

	settings = frappe.get_single("Background Check Settings")
	context.bgc = bgc
	context.token = token
	context.applicant_name = bgc.full_name
	if lang == "en":
		context.consent_text = getattr(settings, "consent_text_en", None) or getattr(settings, "consent_text_id", None) or ""
	else:
		context.consent_text = getattr(settings, "consent_text_id", None) or getattr(settings, "consent_text_en", None) or ""
	context.retention_days = settings.retention_days or 90
	context.export_max_mb = settings.export_max_mb or 100
	context.export_guides = {
		"Instagram": {
			"title": _("Download a copy of your information on Instagram"),
			"url": "https://help.instagram.com/181231772500920",
		},
		"Facebook": {
			"title": _("Access and download your Facebook information"),
			"url": "https://www.facebook.com/help/212802592074644",
		},
		"TikTok": {
			"title": _("Request your TikTok data"),
			"url": "https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/requesting-your-data",
		},
		"LinkedIn": {
			"title": _("Export your LinkedIn account data"),
			"url": "https://www.linkedin.com/help/linkedin/answer/a1339364/downloading-your-account-data",
		},
	}
	context.platforms = frappe.get_all(
		"Background Check Platform",
		filters={"enabled": 1},
		fields=["platform_name", "category", "requires_social_consent"],
		order_by="platform_name asc",
	)
	context.social_platforms = [
		p.platform_name for p in context.platforms
		if p.requires_social_consent or p.platform_name.lower() in ("instagram", "facebook", "tiktok", "linkedin", "twitter/x", "x")
	]
	context.existing_social_accounts = [
		{
			"platform": a.platform,
			"username": a.username,
			"social_consent": a.social_consent or 0,
		}
		for a in bgc.accounts
		if a.platform in context.social_platforms
	]
	context.existing_other_accounts = [
		{
			"platform": a.platform,
			"username": a.username,
		}
		for a in bgc.accounts
		if a.platform not in context.social_platforms
	]
	context.sources = [
		{
			"key": "Platform",
			"label": _("Public Account & Platform Check"),
			"desc": _("Verification of public profile on declared professional platform accounts."),
		},
		{
			"key": "Article",
			"label": _("News & Media Publications"),
			"desc": _("Search for public articles regarding professional track record and achievements."),
		},
		{
			"key": "File",
			"label": _("Public Documents & Publications"),
			"desc": _("Search for public documents or academic publications."),
		},
		{
			"key": "Case history",
			"label": _("Legal Case History (Supreme Court Decisions)"),
			"desc": _("Check open court decisions directory to verify legal integrity."),
		},
		{
			"key": "Posts",
			"label": _("Public Account Activity"),
			"desc": _("Verification of language politeness and risk indicators on platforms with official APIs."),
		},
		{
			"key": "Social Media",
			"label": _("Social Media"),
			"desc": _("Verification of public profile and posts on declared social media accounts (Instagram, Facebook, TikTok, LinkedIn)."),
		},
	]
