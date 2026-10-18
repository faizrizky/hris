// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.listview_settings["Job Applicant"] = {
	onload(listview) {
		listview.page.add_action_item(__("Screen Ulang"), function () {
			let names = listview.get_checked_items().map(d => d.name);
			if (!names.length) return;

			frappe.confirm(
				__("Jadwalkan screen ulang untuk {0} pelamar yang dipilih?", [names.length]),
				function () {
					frappe.call({
						method: "hris_ats.scoring.workflow.bulk_rescreen",
						args: {
							applicant_names: names
						},
						freeze: true,
						freeze_message: __("Menjadwalkan screening ulang..."),
						callback: function (r) {
							frappe.show_alert({
								message: r.message ? r.message.message : __("Screening ulang berhasil dijadwalkan"),
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
