// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.listview_settings["Resume Screening"] = {
	add_fields: ["status", "total_score", "passed", "result_indicator", "job_applicant", "applicant_name", "job_opening"],
	get_indicator(doc) {
		if (doc.status === "Done") {
			if (doc.passed) {
				return [__("Done (Passed)"), "green", "status,=,Done|passed,=,1"];
			} else {
				return [__("Done (Failed)"), "red", "status,=,Done|passed,=,0"];
			}
		} else if (doc.status === "Screening") {
			return [__("Screening..."), "blue", "status,=,Screening"];
		} else if (doc.status === "Queued") {
			return [__("Queued"), "orange", "status,=,Queued"];
		} else if (doc.status === "Needs Review") {
			return [__("Needs Manual Review"), "orange", "status,=,Needs Review"];
		} else {
			return [__("Failed"), "red", "status,=,Failed"];
		}
	},
	onload(listview) {
		if (!frappe.model.can_write("Job Applicant")) return;
		listview.page.add_action_item(__("Rescreen"), function () {
			let names = listview.get_checked_items().map(d => d.name);
			if (!names.length) return;

			frappe.confirm(
				__("Schedule rescreen for {0} selected file(s)?", [names.length]),
				function () {
					frappe.call({
						method: "sentra_ats.scoring.workflow.bulk_rescreen",
						args: {
							applicant_names: names
						},
						freeze: true,
						freeze_message: __("Scheduling rescreen..."),
						callback: function (r) {
							frappe.show_alert({
								message: __("Rescreen successfully scheduled"),
								indicator: "green"
							});
							listview.refresh();
						}
					});
				}
			);
		});
	}
};
