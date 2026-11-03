# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

DEFAULT_METRIC_WEIGHTS = [
	("ATS friendly", 10),
	("Grammar", 5),
	("Date consistency", 10),
	("Information completeness", 10),
	("Education relevance", 10),
	("Skill relevance", 25),
	("Experience relevance", 20),
	("Achievement relevance", 5),
	("Certification relevance", 5),
]

ALL_METRICS = [m[0] for m in DEFAULT_METRIC_WEIGHTS]

# Blueprint red flags: (rule, points, threshold, secondary threshold). New templates get them switched off.
DEFAULT_PENALTY_RULES = [
	("Job Hopping", 15, 1.5, 0),
	("No Impact", 10, 1, 0),
	# Our grammar check is a small typo list, not a real grammar checker: keep its weight low
	("Grammar", 3, 3, 0),
	("Brevity", 5, 3, 1000),
]
DEFAULT_TIERS = [
	(90, 100, "Tier 1 - Highly Recommended", "green"),
	(80, 89, "Tier 2 - Interview", "blue"),
	(70, 79, "Tier 3 - Reserve", "orange"),
	(0, 69, "Tier 4 - Not Recommended", "red"),
]
SUPPORTED_LANGUAGES = {"id", "en"}


class ResumeScreeningTemplate(Document):
	def before_insert(self):
		if not self.metric_weights:
			for metric, weight in DEFAULT_METRIC_WEIGHTS:
				self.append("metric_weights", {
					"metric": metric,
					"weight": weight,
					"enabled": 1,
				})
		if not self.penalty_rules:
			for rule, points, threshold, secondary in DEFAULT_PENALTY_RULES:
				self.append("penalty_rules", {
					"rule": rule, "enabled": 0, "points": points, "threshold": threshold, "secondary_threshold": secondary,
				})
		if not self.score_labels:
			for score_from, score_to, label, indicator in DEFAULT_TIERS:
				self.append("score_labels", {
					"label_type": "Range", "score_from": score_from, "score_to": score_to, "label": label, "indicator": indicator,
				})
		if not self.pass_description:
			self.pass_description = _("Applicant resume is match with the applied job!")
		if not self.fail_description:
			self.fail_description = _("Applicant resume does not meet the minimum criteria.")

	def validate(self):
		self.validate_metric_weights()
		self.validate_score_labels()
		self.validate_active_designations()
		self.validate_rules()

	def validate_rules(self):
		import re

		from hris_ats.scoring.metrics.education_relevance import parse_degree_level

		langs = {x.strip().lower() for x in (self.allowed_languages or "").split(",") if x.strip()}
		if langs - SUPPORTED_LANGUAGES:
			frappe.throw(_("Allowed CV languages can only be: {0}.").format(", ".join(sorted(SUPPORTED_LANGUAGES))))

		seen = set()
		for row in self.penalty_rules or []:
			if row.rule in seen:
				frappe.throw(_("Red flag '{0}' appears more than once.").format(row.rule))
			seen.add(row.rule)
			if not 0 <= (row.points or 0) <= 100:
				frappe.throw(_("Penalty points for '{0}' must be between 0 and 100.").format(row.rule))

		for row in self.knockout_rules or []:
			if row.condition == "Minimum education level" and not parse_degree_level(row.value or ""):
				frappe.throw(_("Unknown education level '{0}'. Use SMA, D3, S1, S2 or S3.").format(row.value))
			if row.condition == "Minimum years of experience" and flt(row.value) <= 0:
				frappe.throw(_("Minimum years of experience must be a number above 0."))
			if row.action == "Cap score" and not 0 <= (row.cap_score or 0) <= 100:
				frappe.throw(_("Cap score must be between 0 and 100."))

		for row in self.custom_rules or []:
			if row.operator == "Matches regex":
				try:
					re.compile(row.value or "")
				except re.error as e:
					frappe.throw(_("Custom rule '{0}' has an invalid regular expression: {1}").format(row.label, e))
			if not 0 <= (row.points or 0) <= 100:
				frappe.throw(_("Points for custom rule '{0}' must be between 0 and 100.").format(row.label))

	def validate_metric_weights(self):
		if not self.metric_weights:
			frappe.throw(_("Metric weights table cannot be empty."))

		metrics_seen = set()
		for row in self.metric_weights:
			if row.metric in metrics_seen:
				frappe.throw(_("Metric '{0}' appears more than once.").format(row.metric))
			metrics_seen.add(row.metric)

		missing = set(ALL_METRICS) - metrics_seen
		if missing:
			frappe.throw(_("The following metrics are missing from the template: {0}").format(", ".join(sorted(missing))))

		extra = metrics_seen - set(ALL_METRICS)
		if extra:
			frappe.throw(_("Unknown metric: {0}").format(", ".join(sorted(extra))))

		for row in self.metric_weights:
			if not 0 <= flt(row.weight) <= 100:
				frappe.throw(_("Weight of '{0}' must be between 0 and 100.").format(row.metric))

		active_total = round(sum(flt(r.weight) for r in self.metric_weights if r.enabled), 2)
		self.total_weight = active_total

		if abs(active_total - 100.0) > 0.001:
			frappe.throw(_("Total active metric weight must equal 100% (currently {0}%).").format(active_total))

	def validate_score_labels(self):
		if not self.score_labels:
			return

		intervals = []
		for row in self.score_labels:
			if row.score_from is None or row.score_from < 0 or row.score_from > 100:
				frappe.throw(_("Score from must be between 0 and 100 for label '{0}'.").format(row.label))

			if row.label_type == "Range":
				if row.score_to is None or row.score_to < 0 or row.score_to > 100:
					frappe.throw(_("Score to must be between 0 and 100 for range label '{0}'.").format(row.label))
				if row.score_from > row.score_to:
					frappe.throw(
						_("Score from ({0}) must be less than or equal to score to ({1}) for label '{2}'.").format(
							row.score_from, row.score_to, row.label
						)
					)
				start, end = row.score_from, row.score_to
			else:
				start, end = row.score_from, row.score_from

			intervals.append((start, end, row.label))

		# Check for overlapping ranges
		for i in range(len(intervals)):
			for j in range(i + 1, len(intervals)):
				s1, e1, l1 = intervals[i]
				s2, e2, l2 = intervals[j]
				if max(s1, s2) <= min(e1, e2):
					frappe.throw(
						_("Score range for label '{0}' ({1}–{2}) overlaps with label '{3}' ({4}–{5}).").format(
							l1, s1, e1, l2, s2, e2
						)
					)

	def validate_active_designations(self):
		if not self.enabled:
			return

		designations = [r.designation for r in (self.job_roles or []) if r.designation]
		if not designations:
			return

		current_name = self.name or ""

		for designation in designations:
			existing = frappe.db.sql(
				"""
				SELECT DISTINCT parent
				FROM `tabResume Screening Template Role`
				WHERE designation = %s
				  AND parent != %s
				  AND parent IN (SELECT name FROM `tabResume Screening Template` WHERE enabled = 1)
				""",
				(designation, current_name),
			)
			if existing:
				frappe.throw(
					_("Designation '{0}' is already used in active template '{1}'.").format(
						designation, existing[0][0]
					)
				)


@frappe.whitelist()
def simulate_template(template_doc: str, file_url: str, job_opening: str | None = None) -> dict:
	"""Score one sample CV with the (possibly unsaved) template on screen. Nothing is stored;
	the uploaded sample file is deleted afterwards."""
	import json

	from hris_ats.scoring.engine import evaluate_resume
	from hris_ats.scoring.extract import extract_cv
	from hris_ats.scoring.workflow import build_criteria, resolve_file_path, template_config

	frappe.has_permission("Resume Screening Template", "write", throw=True)
	data = json.loads(template_doc) if isinstance(template_doc, str) else template_doc
	data["doctype"] = "Resume Screening Template"
	template = frappe.get_doc(data)
	# Only a sample this user uploaded in the last hour and did not attach to a record: never another
	# file such as an applicant's CV
	files = [
		f.name
		for f in frappe.get_all(
			"File",
			filters={
				"file_url": file_url,
				"owner": frappe.session.user,
				"creation": [">=", frappe.utils.add_to_date(frappe.utils.now_datetime(), hours=-1)],
			},
			fields=["name", "attached_to_doctype"],
		)
		if f.attached_to_doctype in (None, "", "Resume Screening Template")
	]
	if not files:
		frappe.throw(_("Upload the sample CV from the simulation dialog."), frappe.PermissionError)
	settings = frappe.get_single("Resume Screening Settings")
	try:
		extraction = extract_cv(resolve_file_path(file_url), min_text_chars_per_page=settings.min_text_chars_per_page or 200)
		result = evaluate_resume(
			extraction,
			template_config(template),
			build_criteria(job_opening),
			metric_pass_threshold=settings.metric_pass_threshold or 60.0,
		)
	finally:
		for name in files:
			frappe.delete_doc("File", name, ignore_permissions=True, force=True)
	result.pop("resume_text", None)
	result.pop("sections", None)
	return result
