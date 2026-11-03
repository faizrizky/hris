// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.listview_settings["Resume Upload Batch"] = {
	onload(listview) {
		if (!frappe.model.can_create("Job Applicant")) return;
		listview.page.set_primary_action(__("Bulk Upload CVs"), () => hris_ats.show_bulk_upload_dialog(), "upload");
	},
};
