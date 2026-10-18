// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Job Applicant", {
	refresh(frm) {
		if (frm.doc.screening_status === "Done" && !frm.is_new()) {
			if (!frm.doc.background_check || frm.doc.recruitment_stage === "Screening") {
				frm.add_custom_button(__("Mulai Background Check"), function () {
					frappe.confirm(
						__("Mulai pemeriksaan latar belakang untuk pelamar {0}? Undangan persetujuan akan dikirimkan ke email kandidat.", [frm.doc.applicant_name]),
						function () {
							frappe.call({
								method: "hris_ats.bgc.consent.initiate_background_check",
								args: {
									applicant_name: frm.doc.name
								},
								freeze: true,
								freeze_message: __("Membuat dokumen Background Check..."),
								callback: function (r) {
									if (r.message) {
										frappe.show_alert({
											message: r.message.message || __("Background Check berhasil dibuat."),
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
