# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import json
import os

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

CUSTOM_FIELDS = {
	"Job Opening": [
		{
			"fieldname": "screening_criteria_section",
			"label": "Screening Criteria",
			"fieldtype": "Section Break",
			"insert_after": "description",
			"collapsible": 0,
		},
		{
			"fieldname": "screening_template",
			"label": "Screening Template",
			"fieldtype": "Link",
			"options": "Resume Screening Template",
			"insert_after": "screening_criteria_section",
		},
		{
			"fieldname": "min_education",
			"label": "Minimum Education",
			"fieldtype": "Select",
			"options": "\nSMA/SMK\nD3\nD4/S1\nS2\nS3",
			"insert_after": "screening_template",
		},
		{
			"fieldname": "min_years_experience",
			"label": "Minimum Experience (Years)",
			"fieldtype": "Float",
			"insert_after": "min_education",
		},
		{
			"fieldname": "column_break_screening",
			"fieldtype": "Column Break",
			"insert_after": "min_years_experience",
		},
		{
			"fieldname": "education_majors",
			"label": "Education Majors",
			"fieldtype": "Small Text",
			"description": "Separate with comma or new line",
			"insert_after": "column_break_screening",
		},
		{
			"fieldname": "relevant_titles",
			"label": "Relevant Job Titles",
			"fieldtype": "Small Text",
			"description": "Separate with comma or new line",
			"insert_after": "education_majors",
		},
		{
			"fieldname": "section_break_skills",
			"label": "Skills & Certifications",
			"fieldtype": "Section Break",
			"insert_after": "relevant_titles",
		},
		{
			"fieldname": "required_skills",
			"label": "Required Skills",
			"fieldtype": "Small Text",
			"description": "One skill per line",
			"insert_after": "section_break_skills",
		},
		{
			"fieldname": "preferred_skills",
			"label": "Preferred Skills",
			"fieldtype": "Small Text",
			"description": "One skill per line",
			"insert_after": "required_skills",
		},
		{
			"fieldname": "certification_keywords",
			"label": "Certification Keywords",
			"fieldtype": "Small Text",
			"description": "One keyword per line",
			"insert_after": "preferred_skills",
		},
	],
	"Job Applicant": [
		{
			"fieldname": "recruitment_stage",
			"label": "Recruitment Stage",
			"fieldtype": "Select",
			"options": "New Applied\nScreening\nBackground Check\nInterview\nOffer\nHired\nRejected",
			"default": "New Applied",
			"insert_after": "status",
			"in_standard_filter": 1,
			"in_list_view": 1,
		},
		{
			"fieldname": "city",
			"label": "City / Region",
			"fieldtype": "Data",
			"insert_after": "country",
		},
		{
			"fieldname": "address",
			"label": "Address",
			"fieldtype": "Data",
			"insert_after": "city",
		},
		{
			"fieldname": "postal_code",
			"label": "Postal Code",
			"fieldtype": "Data",
			"insert_after": "address",
		},
		{
			"fieldname": "resume_screening",
			"label": "Resume Screening",
			"fieldtype": "Link",
			"options": "Resume Screening",
			"read_only": 1,
			"insert_after": "resume_attachment",
		},
		{
			"fieldname": "resume_score",
			"label": "Resume Score",
			"fieldtype": "Float",
			"read_only": 1,
			"insert_after": "resume_screening",
			"in_list_view": 1,
		},
		{
			"fieldname": "screening_status",
			"label": "Screening Status",
			"fieldtype": "Select",
			"options": "\nQueued\nScreening\nDone\nFailed",
			"read_only": 1,
			"insert_after": "resume_score",
			"in_list_view": 1,
		},
		{
			"fieldname": "bgc_risk_level",
			"label": "BGC Risk Level",
			"fieldtype": "Select",
			"options": "\nLow\nMedium\nHigh\nNeeds verification",
			"read_only": 1,
			"insert_after": "screening_status",
			"in_list_view": 1,
		},
		{
			"fieldname": "bgc_conclusion",
			"label": "BGC Conclusion",
			"fieldtype": "Small Text",
			"read_only": 1,
			"insert_after": "bgc_risk_level",
		},
		{
			"fieldname": "background_check",
			"label": "Background Check",
			"fieldtype": "Link",
			"options": "Background Check",
			"read_only": 1,
			"insert_after": "bgc_conclusion",
		},
	],
}


def setup_custom_fields():
	create_custom_fields(CUSTOM_FIELDS, update=True)


def setup_kanban_board():
	"""Membuat Kanban Board 'Recruitment Stages' untuk Job Applicant jika belum ada."""
	if frappe.db.exists("Kanban Board", "Tahap Rekrutmen"):
		if frappe.db.exists("Kanban Board", "Recruitment Stages"):
			frappe.delete_doc("Kanban Board", "Tahap Rekrutmen", force=True)
		else:
			frappe.rename_doc("Kanban Board", "Tahap Rekrutmen", "Recruitment Stages", force=True)

	if frappe.db.exists("Kanban Board", "hiring pipeline"):
		if frappe.db.exists("Kanban Board", "Hiring Pipeline"):
			frappe.delete_doc("Kanban Board", "hiring pipeline", force=True)
		else:
			frappe.rename_doc("Kanban Board", "hiring pipeline", "Hiring Pipeline", force=True)

	if not frappe.db.exists("Kanban Board", "Recruitment Stages"):
		kb = frappe.new_doc("Kanban Board")
		kb.kanban_board_name = "Recruitment Stages"
		kb.reference_doctype = "Job Applicant"
		kb.field_name = "recruitment_stage"
		stages = [
			("New Applied", "Gray"),
			("Screening", "Blue"),
			("Background Check", "Orange"),
			("Interview", "Yellow"),
			("Offer", "Purple"),
			("Hired", "Green"),
			("Rejected", "Red"),
		]
		for stage, ind in stages:
			kb.append("columns", {
				"column_name": stage,
				"status": "Active",
				"indicator": ind,
			})
		kb.insert(ignore_permissions=True)


def setup_number_cards():
	"""Membuat Number Card untuk metrik tahap rekrutmen."""
	cards = [
		{
			"name": "New Applicants ATS",
			"label": "New Applicants",
			"document_type": "Job Applicant",
			"function": "Count",
			"filters_json": '[["Job Applicant","recruitment_stage","=","New Applied",false]]',
			"color": "#718096",
		},
		{
			"name": "Screening Stage ATS",
			"label": "Screening Stage",
			"document_type": "Job Applicant",
			"function": "Count",
			"filters_json": '[["Job Applicant","recruitment_stage","=","Screening",false]]',
			"color": "#3182ce",
		},
		{
			"name": "Background Check Stage ATS",
			"label": "Background Check Stage",
			"document_type": "Job Applicant",
			"function": "Count",
			"filters_json": '[["Job Applicant","recruitment_stage","=","Background Check",false]]',
			"color": "#dd6b20",
		},
		{
			"name": "Interview Stage ATS",
			"label": "Interview Stage",
			"document_type": "Job Applicant",
			"function": "Count",
			"filters_json": '[["Job Applicant","recruitment_stage","=","Interview",false]]',
			"color": "#38a169",
		},
	]

	for c in cards:
		if not frappe.db.exists("Number Card", c["name"]):
			doc = frappe.new_doc("Number Card")
			doc.name = c["name"]
			doc.label = c["label"]
			doc.document_type = c["document_type"]
			doc.function = c["function"]
			doc.filters_json = c["filters_json"]
			doc.color = c["color"]
			doc.is_public = 1
			doc.insert(ignore_permissions=True)


def setup_rekrutmen_workspace():
	"""Menyiapkan Workspace 'Recruitment' di Desk dengan shortcut dan kartu metrik."""
	ws_name = "Recruitment"
	if not frappe.db.exists("Workspace", ws_name):
		ws = frappe.new_doc("Workspace")
		ws.name = ws_name
		ws.label = "Recruitment"
		ws.title = "Recruitment"
		ws.icon = "users"
		ws.module = "HRIS ATS"
		ws.public = 1
		ws.is_hidden = 0
		ws.sequence_id = 15
	else:
		ws = frappe.get_doc("Workspace", ws_name)

	# Siapkan Shortcuts
	shortcuts = [
		{"label": "Job Openings", "type": "DocType", "link_to": "Job Opening", "color": "Blue"},
		{"label": "Applicants (Kanban)", "type": "DocType", "link_to": "Job Applicant", "color": "Grey"},
		{"label": "Resume Screening", "type": "DocType", "link_to": "Resume Screening", "color": "Green"},
		{"label": "Background Check", "type": "DocType", "link_to": "Background Check", "color": "Orange"},
		{"label": "Interview", "type": "DocType", "link_to": "Interview", "color": "Yellow"},
		{"label": "Job Offer", "type": "DocType", "link_to": "Job Offer", "color": "Purple"},
		{"label": "Employee Onboarding", "type": "DocType", "link_to": "Employee Onboarding", "color": "Cyan"},
		{"label": "Screening Template", "type": "DocType", "link_to": "Resume Screening Template", "color": "Teal"},
	]

	ws.set("shortcuts", [])
	for s in shortcuts:
		if frappe.db.exists("DocType", s["link_to"]):
			ws.append("shortcuts", s)

	# Siapkan Number Cards
	cards = [
		"New Applicants ATS",
		"Screening Stage ATS",
		"Background Check Stage ATS",
		"Interview Stage ATS",
	]
	ws.set("number_cards", [])
	for card in cards:
		if frappe.db.exists("Number Card", card):
			ws.append("number_cards", {"number_card_name": card})

	ws.save(ignore_permissions=True)


def setup_roles():
	"""Membuat role 'Background Check Officer' jika belum ada."""
	if not frappe.db.exists("Role", "Background Check Officer"):
		role = frappe.new_doc("Role")
		role.role_name = "Background Check Officer"
		role.desk_access = 1
		role.insert(ignore_permissions=True)


DEFAULT_PLATFORMS = [
	{
		"platform_name": "GitHub",
		"category": "Developer",
		"icon": "github",
		"profile_url_template": "https://github.com/{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "GitHub",
		"requires_social_consent": 0,
		"enabled": 1,
	},
	{
		"platform_name": "LinkedIn",
		"category": "Professional",
		"icon": "linkedin",
		"profile_url_template": "https://www.linkedin.com/in/{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "None",
		"requires_social_consent": 1,
		"login_url": "https://www.linkedin.com/login",
		"session_domains": ".linkedin.com\nlinkedin.com",
		"enabled": 1,
	},
	{
		"platform_name": "Twitter/X",
		"category": "Social",
		"icon": "twitter",
		"profile_url_template": "https://x.com/{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "X",
		"requires_social_consent": 1,
		"enabled": 1,
	},
	{
		"platform_name": "Instagram",
		"category": "Social",
		"icon": "instagram",
		"profile_url_template": "https://www.instagram.com/{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "None",
		"requires_social_consent": 1,
		"login_url": "https://www.instagram.com/accounts/login/",
		"session_domains": ".instagram.com\ninstagram.com",
		"enabled": 1,
	},
	{
		"platform_name": "Facebook",
		"category": "Social",
		"icon": "facebook",
		"profile_url_template": "https://www.facebook.com/{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "None",
		"requires_social_consent": 1,
		"login_url": "https://www.facebook.com/login/",
		"session_domains": ".facebook.com\nfacebook.com",
		"enabled": 1,
	},
	{
		"platform_name": "TikTok",
		"category": "Social",
		"icon": "tiktok",
		"profile_url_template": "https://www.tiktok.com/@{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "None",
		"requires_social_consent": 1,
		"login_url": "https://www.tiktok.com/login",
		"session_domains": ".tiktok.com\ntiktok.com",
		"enabled": 1,
	},
	{
		"platform_name": "YouTube",
		"category": "Creative",
		"icon": "youtube",
		"profile_url_template": "https://www.youtube.com/@{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "YouTube",
		"requires_social_consent": 0,
		"enabled": 1,
	},
	{
		"platform_name": "Reddit",
		"category": "Social",
		"icon": "reddit",
		"profile_url_template": "https://www.reddit.com/user/{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "Reddit",
		"requires_social_consent": 0,
		"enabled": 1,
	},
	{
		"platform_name": "Medium",
		"category": "Creative",
		"icon": "medium",
		"profile_url_template": "https://medium.com/@{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "None",
		"requires_social_consent": 0,
		"enabled": 1,
	},
	{
		"platform_name": "Behance",
		"category": "Creative",
		"icon": "behance",
		"profile_url_template": "https://www.behance.net/{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "None",
		"requires_social_consent": 0,
		"enabled": 1,
	},
]


def setup_default_platforms():
	"""Membuat katalog platform publik bawaan (WhatsMyName excerpt)."""
	if not frappe.db.exists("DocType", "Background Check Platform"):
		return
	for p in DEFAULT_PLATFORMS:
		if not frappe.db.exists("Background Check Platform", p["platform_name"]):
			doc = frappe.new_doc("Background Check Platform")
			doc.update(p)
			doc.insert(ignore_permissions=True)
		else:
			update_vals = {}
			if p.get("requires_social_consent"):
				val = frappe.db.get_value("Background Check Platform", p["platform_name"], "requires_social_consent")
				if not val:
					update_vals["requires_social_consent"] = 1
			if p.get("login_url"):
				curr_url = frappe.db.get_value("Background Check Platform", p["platform_name"], "login_url")
				if not curr_url:
					update_vals["login_url"] = p["login_url"]
			if p.get("session_domains"):
				curr_doms = frappe.db.get_value("Background Check Platform", p["platform_name"], "session_domains")
				if not curr_doms:
					update_vals["session_domains"] = p["session_domains"]
			if update_vals:
				frappe.db.set_value("Background Check Platform", p["platform_name"], update_vals, update_modified=False)


def setup_default_lexicon():
	"""Memuat draf leksikon awal dari fixture."""
	if not frappe.db.exists("DocType", "Background Check Lexicon"):
		return
	fixture_path = frappe.get_app_path("hris_ats", "fixtures", "background_check_lexicon.json")
	if os.path.exists(fixture_path):
		with open(fixture_path, encoding="utf-8") as f:
			items = json.load(f)
		for item in items:
			if not frappe.db.exists("Background Check Lexicon", {"category": item["category"], "term": item["term"]}):
				doc = frappe.new_doc("Background Check Lexicon")
				doc.update(item)
				doc.insert(ignore_permissions=True)


def setup_default_settings():
	"""Inisialisasi nilai awal Background Check Settings."""
	if not frappe.db.exists("DocType", "Background Check Settings"):
		return
	settings = frappe.get_single("Background Check Settings")
	dirty = False
	if not settings.retention_days:
		settings.retention_days = 90
		dirty = True
	if not settings.min_match_confidence:
		settings.min_match_confidence = 50
		dirty = True
	if not settings.max_results_per_source:
		settings.max_results_per_source = 50
		dirty = True
	if not settings.rate_limit_per_minute:
		settings.rate_limit_per_minute = 10
		dirty = True
	if not settings.consent_text_version:
		settings.consent_text_version = "v1.0"
		dirty = True
	if not getattr(settings, "consent_text_id", None):
		settings.consent_text_id = (
			"Saya menyatakan bahwa seluruh informasi dan akun media sosial yang saya berikan "
			"adalah benar. Saya memberikan persetujuan kepada perusahaan untuk melakukan pemeriksaan "
			"latar belakang sesuai ruang lingkup yang saya pilih, sesuai ketentuan UU No. 27 Tahun 2022 "
			"tentang Perlindungan Data Pribadi (UU PDP)."
		)
		dirty = True
	if not getattr(settings, "consent_text_en", None):
		settings.consent_text_en = (
			"I declare that all information and social media accounts provided are accurate and true. "
			"I hereby grant consent to the company to conduct a background check within the selected scope, "
			"in compliance with Law No. 27 of 2022 on Personal Data Protection (PDP Law)."
		)
		dirty = True
	if not getattr(settings, "social_max_posts", None) or settings.social_max_posts < 1:
		settings.social_max_posts = 200
		dirty = True
	if not getattr(settings, "social_max_comments", None) or settings.social_max_comments < 1:
		settings.social_max_comments = 200
		dirty = True
	if not getattr(settings, "social_lookback_months", None) or settings.social_lookback_months < 1:
		settings.social_lookback_months = 12
		dirty = True
	if not getattr(settings, "export_max_mb", None) or settings.export_max_mb < 1:
		settings.export_max_mb = 100
		dirty = True
	if getattr(settings, "enable_social_media", None) is None or settings.enable_social_media == 0:
		settings.enable_social_media = 1
		dirty = True
	# Hanya diisi bila belum pernah disimpan. Daftar yang sengaja dikosongkan System Manager
	# tidak boleh diisi ulang setiap migrate.
	from hris_ats.bgc.fetch import DEFAULT_BLOCKED_DOMAINS, blocked_domains_row_exists

	if not blocked_domains_row_exists():
		settings.fetch_blocked_domains = "\n".join(DEFAULT_BLOCKED_DOMAINS)
		dirty = True
	if dirty:
		settings.save(ignore_permissions=True)



def setup_job_applicant_source():
	"""Memastikan Source 'Website' tersedia untuk pelamar dari web."""
	if not frappe.db.exists("Job Applicant Source", "Website"):
		doc = frappe.new_doc("Job Applicant Source")
		doc.source_name = "Website"
		doc.insert(ignore_permissions=True)


def after_install():
	setup_roles()
	setup_job_applicant_source()
	setup_custom_fields()
	setup_kanban_board()
	setup_number_cards()
	setup_rekrutmen_workspace()
	setup_default_platforms()
	setup_default_lexicon()
	setup_default_settings()


def after_migrate():
	setup_roles()
	setup_job_applicant_source()
	setup_custom_fields()
	setup_kanban_board()
	setup_number_cards()
	setup_rekrutmen_workspace()
	setup_default_platforms()
	setup_default_lexicon()
	setup_default_settings()

