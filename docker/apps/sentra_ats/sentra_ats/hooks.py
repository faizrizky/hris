app_name = "sentra_ats"
app_title = "Sentra ATS"
app_publisher = "HRIS Team"
app_description = "Resume Screening and Background Check for ERPNext / Frappe HR"
app_email = "hr@example.com"
app_license = "mit"

# Apps
# ------------------

required_apps = ["erpnext", "hrms"]

extend_bootinfo = ["sentra_ats.lite.extend_bootinfo", "sentra_ats.menu.extend_bootinfo", "sentra_ats.menu_color.extend_bootinfo"]

# Locks a client site whose subscription is inactive (see sentra_ats.subscription).
before_request = ["sentra_ats.subscription.before_request"]

has_permission = {
	"HRIS Subscription": "sentra_ats.subscription.has_permission",
	"Bank Account": "sentra_ats.bank.bank_account_has_permission",
}

permission_query_conditions = {"Bank Account": "sentra_ats.bank.bank_account_conditions"}

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "sentra_ats",
		"logo": "/assets/sentra_ats/images/logo.png",
		"title": "Sentra ATS",
		"route": "/desk/rekrutmen",
	}
]

# Logo shown in the desk sidebar header (same mark as the HRIS mobile app icon)
app_logo_url = "/assets/sentra_ats/images/logo.png"

# The dock, the rail down the left of the desk, is a document rather than a hook. Author it in
# Manage Dock on a developer-mode site and press Export to App, and it is written to
# `sentra_ats/dock/sentra_ats/sentra_ats.json` for git to carry. An app that ships none has no
# rail: its sidebar gets a switcher in the header instead.
#
# A companion app, one that extends a host app rather than standing on its own, says so with
# `mount_on` on that same record, and its entries are appended to the host's rail. Mounting keeps
# the companion off the apps screen, so it takes precedence over any add_to_apps_screen above.

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = [
	"/assets/sentra_ats/css/hris_lite.css",
	"/assets/sentra_ats/css/menu_color.css",
	"/assets/sentra_ats/css/form_columns.css",
]
app_include_js = [
	"/assets/sentra_ats/js/hris_lite.js",
	"/assets/sentra_ats/js/form_sidebar.js",
	"/assets/sentra_ats/js/landing.js",
	"/assets/sentra_ats/js/menu_color.js",
	"/assets/sentra_ats/js/form_columns.js",
	"/assets/sentra_ats/js/crawler_login_dialog.js",
	"/assets/sentra_ats/js/message.js",
	"/assets/sentra_ats/js/bulk_upload.js",
]

# include js, css files in header of web template
# web_include_css = "/assets/sentra_ats/css/sentra_ats.css"
# web_include_js = "/assets/sentra_ats/js/sentra_ats.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "sentra_ats/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
	"Employee": "public/js/employee.js",
	"HRIS Subscription": "public/js/hris_subscription.js",
	"Job Applicant": "public/js/job_applicant.js",
	"Job Opening": "public/js/job_opening.js",
}

doctype_list_js = {
	"Additional Salary": "public/js/additional_salary_list.js",
	"HRIS Subscription": "public/js/hris_subscription_list.js",
	"Job Applicant": "public/js/job_applicant_list.js",
}

website_route_rules = [
	{"from_route": "/ats-consent", "to_route": "ats_consent"},
]


# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "sentra_ats/public/icons.svg"

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
		"sentra_ats.i18n.render",
	],
}


# Installation
# ------------

after_install = "sentra_ats.setup.after_install"
after_migrate = "sentra_ats.setup.after_migrate"


# Uninstallation
# ------------

# before_uninstall = "sentra_ats.uninstall.before_uninstall"
# after_uninstall = "sentra_ats.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "sentra_ats.utils.before_app_install"
# after_app_install = "sentra_ats.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "sentra_ats.utils.before_app_uninstall"
# after_app_uninstall = "sentra_ats.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "sentra_ats.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "sentra_ats.notifications.get_notification_config"

# Awesome Bar
# -----------
# Extra search results: list of dicts with label, description, route, index.
# route: ["List", "ToDo"], "/desk/docs/some/page", or "https://example.com"
# awesomebar_search = ["sentra_ats.search.awesomebar_results"]

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
	"User": {"validate": "sentra_ats.menu_color.validate_user"},
	"Employee": {"validate": ["sentra_ats.bank.mirror_to_employee", "sentra_ats.hr_compliance.validate_employee"]},
	"Job Applicant": {
		"after_insert": "sentra_ats.scoring.workflow.on_job_applicant_insert",
		"on_update": "sentra_ats.scoring.workflow.on_job_applicant_update",
	},
	"Interview": {
		"validate": "sentra_ats.scoring.workflow.validate_interview",
		"on_update": "sentra_ats.scoring.workflow.on_interview_update",
	},
	"Job Offer": {
		"on_update": "sentra_ats.scoring.workflow.on_job_offer_update",
	},
}


# Scheduled Tasks
# ---------------

scheduler_events = {
	"daily": [
		"sentra_ats.tasks.daily_retention_purge",
		"sentra_ats.subscription.refresh_all",
	],
}
# 		"sentra_ats.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "sentra_ats.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "sentra_ats.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "sentra_ats.event.get_events"
# }
override_whitelisted_methods = {
	"hrms.overrides.employee_master.get_assignable_masters": "sentra_ats.overrides.get_assignable_masters",
	"frappe.client.get_single_value": "sentra_ats.overrides.get_single_value",
}
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "sentra_ats.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["sentra_ats.utils.before_request"]
# after_request = ["sentra_ats.utils.after_request"]

# Job Events
# ----------
# before_job = ["sentra_ats.utils.before_job"]
# after_job = ["sentra_ats.utils.after_job"]

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
# 	"sentra_ats.auth.validate"
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

