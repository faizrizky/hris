// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Job Applicant", {
	refresh(frm) {
		if (!frm.is_new() && !frm._hris_ats_realtime) {
			frm._hris_ats_realtime = true;
			frappe.realtime.doc_subscribe("Job Applicant", frm.doc.name);
			frappe.realtime.on("hris_ats_screening_finished", (data) => {
				if (data.applicant !== frm.doc.name) return;
				frappe.show_alert({
					message: __("Resume screening finished (score {0}). Form updated.", [data.score]),
					indicator: "green",
				});
				if (!frm.is_dirty()) frm.reload_doc();
			});
		}

		if (!frm.is_new() && frm.doc.resume_attachment) {
			frm.add_custom_button(__("Screen Again"), function () {
				frappe.call({
					method: "hris_ats.scoring.workflow.rescreen_applicant",
					args: {
						applicant_name: frm.doc.name
					},
					freeze: true,
					freeze_message: __("Starting resume rescreening..."),
					callback: function (r) {
						frappe.show_alert({
							message: __("Rescreening scheduled successfully"),
							indicator: "green"
						});
						frm.reload_doc();
					}
				});
			});
		}

		if (frm.doc.screening_status === "Done" && !frm.is_new()) {
			if (!frm.doc.background_check || frm.doc.recruitment_stage === "Screening") {
				frm.add_custom_button(__("Start Background Check"), function () {
					frappe.confirm(
						__("Start background check for applicant {0}? A consent invitation will be sent to the candidate's email.", [frm.doc.applicant_name]),
						function () {
							frappe.call({
								method: "hris_ats.bgc.consent.initiate_background_check",
								args: {
									applicant_name: frm.doc.name
								},
								freeze: true,
								freeze_message: __("Creating Background Check document..."),
								callback: function (r) {
									if (r.message) {
										frappe.show_alert({
											message: r.message.message || __("Background Check created successfully."),
											indicator: "green"
										});
										frm.reload_doc();
									}
								}
							});
						}
					);
				}, __("Actions"));
			}
		}
	}
});
