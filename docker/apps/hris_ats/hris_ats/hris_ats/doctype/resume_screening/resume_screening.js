// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Resume Screening", {
	refresh(frm) {
		if (!frm.is_new() && frm.doc.status !== "Screening") {
			frm.add_custom_button(__("Screen Ulang"), function () {
				frappe.call({
					method: "hris_ats.scoring.workflow.rescreen",
					args: {
						screening_name: frm.doc.name
					},
					freeze: true,
					freeze_message: __("Memulai screening ulang..."),
					callback: function (r) {
						frm.reload_doc();
					}
				});
			});
		}
	}
});
