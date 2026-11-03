# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document

from hris_ats.i18n import render
from hris_ats.scoring.rules import PENALTY_RULES


class ResumeScreening(Document):
	def onload(self):
		# Reasons are stored as English templates; show them in the reader's language in the
		# standard grids. validate() puts the English text back, so a save never stores a translation.
		for row in self._reason_rows():
			row.reason = render(row.reason_template, _translated_params(row.reason_params))
		for row in self.rule_results or []:
			if row.rule_type == "Penalty":
				row.rule = _(row.rule)
		if self.template:
			self.set_onload(
				"hide_penalty_points",
				frappe.db.get_value("Resume Screening Template", self.template, "hide_penalty_points"),
			)

	def validate(self):
		for row in self._reason_rows():
			row.reason = render(row.reason_template, row.reason_params, lang="en")
		english = {_(name): name for name in PENALTY_RULES}
		for row in self.rule_results or []:
			if row.rule_type == "Penalty":
				row.rule = english.get(row.rule, row.rule)

	def _reason_rows(self):
		return [row for row in (self.results or []) + (self.rule_results or []) if row.reason_template]

	def on_update(self):
		# Sync override label to applicant or update results if needed
		pass


def _translated_params(params: str | None) -> dict:
	"""Parameter values that are known words (operators, section names) are translated too."""
	try:
		values = json.loads(params or "{}")
	except ValueError:
		return {}
	return {k: _(v) if isinstance(v, str) else v for k, v in values.items()}
