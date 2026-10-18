// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Resume Screening Template", {
	refresh(frm) {
		frm.trigger("calculate_total_weight");
	},
	calculate_total_weight(frm) {
		let total = 0;
		(frm.doc.metric_weights || []).forEach(row => {
			if (row.enabled) {
				total += flt(row.weight);
			}
		});
		total = Math.round(total * 100) / 100;
		frm.set_value("total_weight", total);
		if (Math.abs(total - 100) > 0.001) {
			frm.set_df_property(
				"total_weight",
				"description",
				__("<span style='color:red;'>Total bobot harus tepat 100%. Saat ini: {0}%</span>", [total])
			);
		} else {
			frm.set_df_property(
				"total_weight",
				"description",
				__("<span style='color:green;'>Total bobot tepat 100%.</span>")
			);
		}
	}
});

frappe.ui.form.on("Resume Screening Metric Weight", {
	weight(frm) {
		frm.trigger("calculate_total_weight");
	},
	enabled(frm) {
		frm.trigger("calculate_total_weight");
	},
	metric_weights_remove(frm) {
		frm.trigger("calculate_total_weight");
	}
});
