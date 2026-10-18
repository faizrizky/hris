# Copyright (c) 2026, HRIS Team and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ResumeScreening(Document):
	def on_update(self):
		# Sync override label to applicant or update results if needed
		pass
