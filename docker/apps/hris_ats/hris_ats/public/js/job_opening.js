// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Job Opening", {
	refresh(frm) {
		if (frm.is_new() || !frappe.model.can_create("Job Applicant")) return;
		frm.add_custom_button(__("Bulk Upload CVs"), () => hris_ats.show_bulk_upload_dialog(frm.doc.name), __("Actions"));
	},
});
