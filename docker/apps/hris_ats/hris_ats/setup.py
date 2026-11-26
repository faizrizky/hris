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
			"insert_after": "resume_screening",
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
			"fieldname": "column_break_screening",
			"fieldtype": "Column Break",
			"insert_after": "resume_attachment",
		},
		{
			"fieldname": "section_break_cover",
			"fieldtype": "Section Break",
			"insert_after": "resume_attachment",
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
			"options": "\nQueued\nScreening\nDone\nNeeds Review\nFailed",
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


BANK_FIELDS = {
	"Employee": [
		{"fieldname": "custom_bank_account", "label": "Bank Account", "fieldtype": "Link", "options": "Bank Account",
			"insert_after": "bank_details_section", "depends_on": "eval:doc.salary_mode == 'Bank'"},
		{"fieldname": "custom_ba_account_name", "label": "Account Name", "fieldtype": "Data", "read_only": 1,
			"fetch_from": "custom_bank_account.account_name", "insert_after": "custom_bank_account"},
		{"fieldname": "custom_ba_bank", "label": "Bank", "fieldtype": "Data", "read_only": 1,
			"fetch_from": "custom_bank_account.bank", "insert_after": "custom_ba_account_name"},
		{"fieldname": "custom_ba_column", "fieldtype": "Column Break", "insert_after": "custom_ba_bank"},
		{"fieldname": "custom_ba_account_no", "label": "Bank Account No", "fieldtype": "Data", "read_only": 1,
			"fetch_from": "custom_bank_account.bank_account_no", "insert_after": "custom_ba_column"},
		{"fieldname": "custom_ba_iban", "label": "IBAN", "fieldtype": "Data", "read_only": 1,
			"fetch_from": "custom_bank_account.iban", "insert_after": "custom_ba_account_no"},
		{"fieldname": "custom_ba_branch_code", "label": "Branch Code", "fieldtype": "Data", "read_only": 1,
			"fetch_from": "custom_bank_account.branch_code", "insert_after": "custom_ba_iban"},
	]
}


def setup_custom_fields():
	create_custom_fields(CUSTOM_FIELDS, update=True)
	create_custom_fields(BANK_FIELDS, update=True)
	from hris_ats.bank import setup_bank_account_access

	setup_bank_account_access()
	setup_job_applicant_layout()


def setup_job_applicant_layout():
	"""Susun bagian Resume di Job Applicant menjadi dua kolom:
	kiri  = Link, Resume Score, Resume Screening
	kanan = Attachment, Screening Status, Background Check
	lalu Cover Letter selebar penuh di bawahnya."""
	frappe.clear_cache(doctype="Job Applicant")
	names = [f.fieldname for f in frappe.get_meta("Job Applicant").fields]
	block = [
		"resume_score",
		"resume_screening",
		"column_break_screening",
		"resume_attachment",
		"screening_status",
		"background_check",
		"section_break_cover",
		"cover_letter",
		"bgc_risk_level",
		"bgc_conclusion",
	]
	if "open_resume_button" not in names or any(b not in names for b in block):
		return
	names = [n for n in names if n not in block]
	pos = names.index("open_resume_button") + 1
	names[pos:pos] = block
	frappe.make_property_setter(
		{
			"doctype": "Job Applicant",
			"doctype_or_field": "DocType",
			"property": "field_order",
			"value": json.dumps(names),
			"property_type": "Data",
		}
	)
	frappe.clear_cache(doctype="Job Applicant")


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


NUMBER_CARDS = [
	# (name = label, doctype, filters, color)
	("New Applicants", "Job Applicant", [["Job Applicant", "recruitment_stage", "=", "New Applied", False]], "#718096"),
	("Screening Stage", "Job Applicant", [["Job Applicant", "recruitment_stage", "=", "Screening", False]], "#3182ce"),
	("Background Check Stage", "Job Applicant", [["Job Applicant", "recruitment_stage", "=", "Background Check", False]], "#dd6b20"),
	("Interview Stage", "Job Applicant", [["Job Applicant", "recruitment_stage", "=", "Interview", False]], "#38a169"),
	("Offer Stage", "Job Applicant", [["Job Applicant", "recruitment_stage", "=", "Offer", False]], "#805ad5"),
	("Hired", "Job Applicant", [["Job Applicant", "recruitment_stage", "=", "Hired", False]], "#2f855a"),
	("Checks Waiting Consent", "Background Check", [["Background Check", "consent_status", "=", "Pending", False]], "#d69e2e"),
	("High Risk Checks", "Background Check", [["Background Check", "risk_level_auto", "in", ["High", "Tinggi"], False]], "#e53e3e"),
]

DASHBOARD_CHARTS = [
	{
		"chart_name": "Applicants by Stage",
		"chart_type": "Group By",
		"document_type": "Job Applicant",
		"group_by_type": "Count",
		"group_by_based_on": "recruitment_stage",
		"number_of_groups": 0,
		"type": "Bar",
		"color": "#3182ce",
	},
	{
		"chart_name": "Background Check by Risk",
		"chart_type": "Group By",
		"document_type": "Background Check",
		"group_by_type": "Count",
		"group_by_based_on": "risk_level_auto",
		"number_of_groups": 0,
		"type": "Bar",
		"color": "#dd6b20",
	},
	{
		"chart_name": "Applications per Month",
		"chart_type": "Count",
		"document_type": "Job Applicant",
		"based_on": "creation",
		"timeseries": 1,
		"time_interval": "Monthly",
		"timespan": "Last Year",
		"type": "Line",
		"color": "#38a169",
	},
]


def setup_number_cards():
	"""Membuat Number Card metrik rekrutmen (nama kartu = label)."""
	for label, doctype, filters, color in NUMBER_CARDS:
		if frappe.db.exists("Number Card", label):
			continue
		doc = frappe.new_doc("Number Card")
		doc.label = label
		doc.document_type = doctype
		doc.function = "Count"
		doc.filters_json = json.dumps(filters)
		doc.color = color
		doc.is_public = 1
		doc.show_percentage_stats = 1
		doc.stats_time_interval = "Monthly"
		doc.insert(ignore_permissions=True)


def setup_dashboard_charts():
	for c in DASHBOARD_CHARTS:
		if frappe.db.exists("Dashboard Chart", c["chart_name"]):
			# Keep the shipped look in sync (a donut formatted counts as currency)
			frappe.db.set_value("Dashboard Chart", c["chart_name"], {"type": c["type"], "color": c.get("color")}, update_modified=False)
			continue
		doc = frappe.new_doc("Dashboard Chart")
		doc.update({**c, "is_public": 1, "filters_json": "[]", "dynamic_filters_json": "[]"})
		doc.insert(ignore_permissions=True)


def _block(kind: str, data: dict | None = None) -> dict:
	import uuid

	return {"id": uuid.uuid4().hex[:10], "type": kind, "data": data or {}}


def _header(text: str, col: int = 12) -> dict:
	return _block("header", {"text": f'<span class="h4"><b>{text}</b></span>', "col": col})


def setup_rekrutmen_workspace():
	"""Workspace 'Rekrutmen' (modul HRIS ATS): kartu angka, grafik, pintasan, dan kartu tautan.

	Hanya menyentuh workspace milik app ini; workspace 'Recruitment' bawaan HRMS tidak diubah.
	"""
	ws_name = "Rekrutmen"
	if frappe.db.exists("Workspace", ws_name):
		ws = frappe.get_doc("Workspace", ws_name)
	else:
		ws = frappe.new_doc("Workspace")
		ws.name = ws_name
	ws.label = ws_name
	ws.title = ws_name
	ws.module = "HRIS ATS"
	ws.icon = "users"
	ws.public = 1
	ws.is_hidden = 0
	ws.sequence_id = 15

	card_names = [c[0] for c in NUMBER_CARDS if frappe.db.exists("Number Card", c[0])]
	ws.set("number_cards", [])
	for name in card_names:
		ws.append("number_cards", {"number_card_name": name, "label": name})

	chart_names = [c["chart_name"] for c in DASHBOARD_CHARTS if frappe.db.exists("Dashboard Chart", c["chart_name"])]
	ws.set("charts", [])
	for name in chart_names:
		ws.append("charts", {"chart_name": name, "label": name})

	shortcuts = [
		("Job Opening", "Job Opening", "DocType", "Blue", {"status": "Open"}, "{} Open"),
		("Job Applicant", "Job Applicant", "DocType", "Grey", {"status": "Open"}, "{} Open"),
		("Resume Screening", "Resume Screening", "DocType", "Green", {"status": "Needs Review"}, "{} Needs review"),
		("Background Check", "Background Check", "DocType", "Orange", {"status": ["in", ["Waiting Consent", "Queued", "Crawling"]]}, "{} Active"),
		("Interview", "Interview", "DocType", "Yellow", None, None),
		("Job Offer", "Job Offer", "DocType", "Purple", None, None),
		("Crawl Test", "bgc-crawl-test", "Page", "Cyan", None, None),
		("Background Check Settings", "Background Check Settings", "DocType", "Grey", None, None),
	]
	ws.set("shortcuts", [])
	used_shortcuts = []
	for label, link_to, kind, color, stats, fmt in shortcuts:
		if kind == "DocType" and not frappe.db.exists("DocType", link_to):
			continue
		if kind == "Page" and not frappe.db.exists("Page", link_to):
			continue
		row = {"label": label, "link_to": link_to, "type": kind, "color": color}
		if stats:
			row["stats_filter"] = json.dumps(stats)
			row["format"] = fmt
		ws.append("shortcuts", row)
		used_shortcuts.append(label)

	groups = [
		(
			"Rekrutmen",
			[("Job Opening", "DocType"), ("Job Applicant", "DocType"), ("Interview", "DocType"), ("Job Offer", "DocType"),
			 ("Appointment Letter", "DocType"), ("Employee Onboarding", "DocType")],
		),
		(
			"Screening Resume",
			[("Resume Screening", "DocType"), ("Resume Screening Template", "DocType"), ("Resume Upload Batch", "DocType"), ("Resume Screening Settings", "DocType")],
		),
		(
			"Background Check",
			[("Background Check", "DocType"), ("Background Check Finding", "DocType"), ("Background Check Platform", "DocType"),
			 ("Background Check Lexicon", "DocType"), ("Background Check Crawler Account", "DocType"),
			 ("Background Check Settings", "DocType"), ("bgc-crawl-test", "Page")],
		),
	]
	ws.set("links", [])
	card_blocks = []
	for group_label, items in groups:
		ws.append("links", {"type": "Card Break", "label": group_label, "hidden": 0})
		for link_to, kind in items:
			if kind == "DocType" and not frappe.db.exists("DocType", link_to):
				continue
			label = "Crawl Test" if kind == "Page" else link_to
			ws.append("links", {"type": "Link", "label": label, "link_type": kind, "link_to": link_to, "onboard": 0})
		card_blocks.append(_block("card", {"card_name": group_label, "col": 4}))

	content = [_header("Pipeline Rekrutmen")]
	content += [_block("number_card", {"number_card_name": n, "col": 3}) for n in card_names]
	content += [_block("spacer"), _header("Analitik")]
	for i, name in enumerate(chart_names):
		content.append(_block("chart", {"chart_name": name, "col": 6 if i < 2 else 12}))
	content += [_block("spacer"), _header("Pintasan")]
	content += [_block("shortcut", {"shortcut_name": n, "col": 3}) for n in used_shortcuts]
	content += [_block("spacer"), _header("Menu")]
	content += card_blocks
	ws.content = json.dumps(content)
	ws.flags.ignore_permissions = True
	ws.save()


# Blueprint presets: core qualifications carry the score; reading quality metrics (ATS friendly,
# Date consistency, Information completeness) are turned off and only feed "reading confidence".
SCREENING_PRESETS = [
	{
		"template_name": "ATS Preset - Entry-Level",
		"candidate_level": "Entry-Level",
		"weights": {"Skill relevance": 40, "Education relevance": 40, "Experience relevance": 10, "Certification relevance": 10},
		"penalties": {"Job Hopping": False, "No Impact": False, "Grammar": True, "Brevity": True},
	},
	{
		"template_name": "ATS Preset - Junior / Mid",
		"candidate_level": "Junior / Mid",
		"weights": {"Skill relevance": 50, "Experience relevance": 30, "Education relevance": 15, "Certification relevance": 5},
		"penalties": {"Job Hopping": True, "No Impact": True, "Grammar": True, "Brevity": True},
	},
	{
		"template_name": "ATS Preset - Senior / Manager",
		"candidate_level": "Senior / Manager",
		"weights": {"Experience relevance": 40, "Skill relevance": 35, "Education relevance": 15, "Certification relevance": 10},
		"penalties": {"Job Hopping": True, "No Impact": True, "Grammar": True, "Brevity": True},
	},
	{
		"template_name": "ATS Preset - C-Level / Researcher",
		"candidate_level": "C-Level / Researcher",
		"weights": {"Experience relevance": 40, "Skill relevance": 25, "Education relevance": 20, "Certification relevance": 15},
		# Journals and portfolios make long CVs normal at this level
		"penalties": {"Job Hopping": True, "No Impact": True, "Grammar": True, "Brevity": False},
	},
]


def fill_default_tier_descriptions():
	"""Tier labels created before they had a description get the default one (never overwrites text)."""
	from hris_ats.hris_ats.doctype.resume_screening_template.resume_screening_template import DEFAULT_TIERS

	for _from, _to, label, _indicator, description in DEFAULT_TIERS:
		frappe.db.sql(
			"""UPDATE `tabResume Screening Score Label` SET description = %s
			WHERE label = %s AND (description IS NULL OR description = '')""",
			(description, label),
		)


def setup_screening_presets():
	"""Ship one ready-to-use template per candidate level (created once; HR edits or clones them)."""
	from hris_ats.hris_ats.doctype.resume_screening_template.resume_screening_template import (
		ALL_METRICS,
		DEFAULT_PENALTY_RULES,
	)

	if not frappe.db.exists("DocType", "Resume Screening Template"):
		return
	for preset in SCREENING_PRESETS:
		if frappe.db.exists("Resume Screening Template", preset["template_name"]):
			continue
		doc = frappe.new_doc("Resume Screening Template")
		doc.template_name = preset["template_name"]
		doc.candidate_level = preset["candidate_level"]
		doc.enabled = 1
		doc.min_score_to_pass = 80
		doc.allowed_languages = "id,en"
		doc.hide_penalty_points = 1
		for metric in ALL_METRICS:
			weight = preset["weights"].get(metric, 0)
			doc.append("metric_weights", {"metric": metric, "weight": weight, "enabled": 1 if weight else 0})
		for rule, points, threshold, secondary in DEFAULT_PENALTY_RULES:
			doc.append("penalty_rules", {
				"rule": rule,
				"enabled": 1 if preset["penalties"][rule] else 0,
				"points": points,
				"threshold": threshold,
				"secondary_threshold": secondary,
			})
		doc.insert(ignore_permissions=True)


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
		"platform_name": "Threads",
		"category": "Social",
		"icon": "threads",
		"profile_url_template": "https://www.threads.com/@{username}",
		"check_method": "Status code",
		"check_value": "200",
		"post_api": "None",
		"requires_social_consent": 1,
		"login_url": "https://www.threads.com/login",
		"session_domains": ".threads.com\nthreads.com\n.threads.net\nthreads.net\n.instagram.com\ninstagram.com",
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
	if getattr(settings, "social_lookback_months", None) is None or settings.social_lookback_months < 0:
		settings.social_lookback_months = 0
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
	setup_dashboard_charts()
	setup_rekrutmen_workspace()
	setup_screening_presets()
	fill_default_tier_descriptions()
	setup_default_platforms()
	setup_default_lexicon()
	setup_default_settings()


def after_migrate():
	setup_roles()
	setup_job_applicant_source()
	setup_custom_fields()
	setup_kanban_board()
	setup_number_cards()
	setup_dashboard_charts()
	setup_rekrutmen_workspace()
	setup_screening_presets()
	fill_default_tier_descriptions()
	setup_default_platforms()
	setup_default_lexicon()
	setup_default_settings()
	apply_lite_profile()
	setup_hr_compliance()
	setup_subscription_access()
	remove_legacy_langganan()
	apply_module_lock()  # last: it must see the permissions set up above



def apply_lite_profile():
	"""HR-focus profile, only on sites that opted in with `hris_lite_ui` (see hris_ats.lite.profile)."""
	if frappe.conf.get("hris_lite_ui"):
		from hris_ats.lite.profile import apply

		apply()


def apply_module_lock():
	"""Expenses, Payroll and Tax & Benefits locked by permissions on every site (see hris_ats.lock)."""
	from hris_ats.lock import after_migrate

	after_migrate()


def setup_hr_compliance():
	from hris_ats.hr_compliance import setup_hr_compliance as _setup

	_setup()


def remove_legacy_langganan():
	from hris_ats.subscription import remove_legacy_langganan as _remove

	_remove()


def setup_subscription_access():
	"""Subscriptions and app updates belong to the control-plane site (sentra); client sites get no access at all."""
	if frappe.conf.get("hris_control_plane"):
		if frappe.db.exists("Sidebar", "HR Setup"):
			from frappe.desk.doctype.custom_sidebar.custom_sidebar import add_site_sidebar_item

			add_site_sidebar_item(
				"HR Setup",
				{"label": "HRIS Subscription", "type": "Link", "link_type": "DocType",
					"link_to": "HRIS Subscription", "icon": "star", "collapsible": 1},
			)
		return

	from frappe.permissions import rights, update_permission_property

	from hris_ats.subscription import MANAGED_DOCTYPES

	for dt in MANAGED_DOCTYPES:
		if not frappe.db.exists("DocType", dt):
			continue
		roles = set(frappe.get_all("DocPerm", filters={"parent": dt}, pluck="role")) | set(
			frappe.get_all("Custom DocPerm", filters={"parent": dt}, pluck="role")
		)
		for role in roles - {"Administrator"}:
			for ptype in rights:
				update_permission_property(dt, role, 0, ptype, 0)
