app_name = "hris_ats"
app_title = "HRIS ATS"
app_publisher = "HRIS Team"
app_description = "Resume Screening and Background Check for ERPNext / Frappe HR"
app_email = "hr@example.com"
app_license = "mit"

# Apps
# ------------------

required_apps = ["erpnext", "hrms"]

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "hris_ats",
# 		"logo": "/assets/hris_ats/logo.png",
# 		"title": "HRIS ATS",
# 		"route": "/hris_ats",
# 		"has_permission": "hris_ats.api.permission.has_app_permission",
# 	}
# ]

# The dock, the rail down the left of the desk, is a document rather than a hook. Author it in
# Manage Dock on a developer-mode site and press Export to App, and it is written to
# `hris_ats/dock/hris_ats/hris_ats.json` for git to carry. An app that ships none has no
# rail: its sidebar gets a switcher in the header instead.
#
# A companion app, one that extends a host app rather than standing on its own, says so with
# `mount_on` on that same record, and its entries are appended to the host's rail. Mounting keeps
# the companion off the apps screen, so it takes precedence over any add_to_apps_screen above.

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/hris_ats/css/hris_ats.css"
app_include_js = [
	"/assets/hris_ats/js/crawler_login_dialog.js",
]

# include js, css files in header of web template
# web_include_css = "/assets/hris_ats/css/hris_ats.css"
# web_include_js = "/assets/hris_ats/js/hris_ats.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "hris_ats/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
	"Job Applicant": "public/js/job_applicant.js",
}

doctype_list_js = {
	"Job Applicant": "public/js/job_applicant_list.js",
}

website_route_rules = [
	{"from_route": "/ats-consent", "to_route": "ats_consent"},
]


# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "hris_ats/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
jinja = {
	"methods": [
		"hris_ats.i18n.render",
	],
}


# Installation
# ------------

after_install = "hris_ats.setup.after_install"
after_migrate = "hris_ats.setup.after_migrate"


# Uninstallation
# ------------

# before_uninstall = "hris_ats.uninstall.before_uninstall"
# after_uninstall = "hris_ats.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "hris_ats.utils.before_app_install"
# after_app_install = "hris_ats.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "hris_ats.utils.before_app_uninstall"
# after_app_uninstall = "hris_ats.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "hris_ats.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "hris_ats.notifications.get_notification_config"

# Awesome Bar
# -----------
# Extra search results: list of dicts with label, description, route, index.
# route: ["List", "ToDo"], "/desk/docs/some/page", or "https://example.com"
# awesomebar_search = ["hris_ats.search.awesomebar_results"]

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Job Applicant": {
		"after_insert": "hris_ats.scoring.workflow.on_job_applicant_insert",
		"on_update": "hris_ats.scoring.workflow.on_job_applicant_update",
	},
	"Interview": {
		"validate": "hris_ats.scoring.workflow.validate_interview",
		"on_update": "hris_ats.scoring.workflow.on_interview_update",
	},
	"Job Offer": {
		"on_update": "hris_ats.scoring.workflow.on_job_offer_update",
	},
}


# Scheduled Tasks
# ---------------

scheduler_events = {
	"daily": [
		"hris_ats.tasks.daily_retention_purge"
	],
}
# 		"hris_ats.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "hris_ats.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "hris_ats.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "hris_ats.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "hris_ats.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["hris_ats.utils.before_request"]
# after_request = ["hris_ats.utils.after_request"]

# Job Events
# ----------
# before_job = ["hris_ats.utils.before_job"]
# after_job = ["hris_ats.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"hris_ats.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------

# Website Route Rules
# -------------------
website_route_rules = [
	{"from_route": "/bgc_consent", "to_route": "ats_consent"},
	{"from_route": "/bgc-consent", "to_route": "ats_consent"},
	{"from_route": "/ats-consent", "to_route": "ats_consent"},
]

