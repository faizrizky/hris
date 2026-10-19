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


class ResumeScreeningTemplate(Document):
	def before_insert(self):
		if not self.metric_weights:
			for metric, weight in DEFAULT_METRIC_WEIGHTS:
				self.append("metric_weights", {
					"metric": metric,
					"weight": weight,
					"enabled": 1,
				})
		if not self.pass_description:
			self.pass_description = _("Applicant resume is match with the applied job!")
		if not self.fail_description:
			self.fail_description = _("Applicant resume does not meet the minimum criteria.")

	def validate(self):
		self.validate_metric_weights()
		self.validate_score_labels()
		self.validate_active_designations()

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
