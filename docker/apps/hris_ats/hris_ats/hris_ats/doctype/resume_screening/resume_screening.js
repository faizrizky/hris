// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Resume Screening", {
	refresh(frm) {
		frm.trigger("render_banner");
		frm.trigger("setup_realtime_listener");

		if (!frm.is_new() && frm.doc.status !== "Screening") {
			frm.add_custom_button(__("Screen Again"), function () {
				frappe.call({
					method: "hris_ats.scoring.workflow.rescreen",
					args: {
						screening_name: frm.doc.name
					},
					freeze: true,
					freeze_message: __("Starting rescreening..."),
					callback: function (r) {
						frappe.show_alert({
							message: __("Rescreening started successfully"),
							indicator: "green"
						});
						frm.reload_doc();
					}
				});
			});
		}

		if (frm.doc.resume_file) {
			frm.add_custom_button(__("Download CV File"), function () {
				window.open(frm.doc.resume_file, "_blank");
			}, __("Actions"));
		}
	},

	render_banner(frm) {
		if (frm.is_new()) return;

		let indicator_color = frm.doc.result_indicator || (frm.doc.passed ? "green" : "red");
		let bg_map = {
			"green": "#e6fffa",
			"blue": "#ebf8ff",
			"orange": "#fffaf0",
			"red": "#fff5f5"
		};
		let border_map = {
			"green": "#319795",
			"blue": "#3182ce",
			"orange": "#dd6b20",
			"red": "#e53e3e"
		};

		let bg_color = bg_map[indicator_color] || "#edf2f7";
		let border_color = border_map[indicator_color] || "#cbd5e0";

		let display_label = frm.doc.hr_override_label || frm.doc.result_label || (frm.doc.passed ? __("Qualified") : __("Not Qualified"));
		let display_desc = frm.doc.result_description || "";
		let is_overridden = !!frm.doc.hr_override_label;

		let override_badge = is_overridden ? `<span class="badge badge-warning" style="margin-left: 8px;">${__("HR Override")}</span>` : "";

		let html = `
			<div class="screening-banner" style="
				background-color: ${bg_color};
				border-left: 6px solid ${border_color};
				padding: 16px 20px;
				margin-bottom: 20px;
				border-radius: 6px;
				display: flex;
				justify-content: space-between;
				align-items: center;
			">
				<div>
					<div style="display: flex; align-items: center; gap: 8px;">
						<h3 style="margin: 0; color: #2d3748; font-weight: 700; font-size: 1.25rem;">
							${__(display_label)}
						</h3>
						${override_badge}
						<button class="btn btn-xs btn-default btn-override-label" style="margin-left: 8px;" title="${__('Edit result label')}">
							<i class="fa fa-pencil"></i>
						</button>
					</div>
					<p style="margin: 6px 0 0 0; color: #4a5568; font-size: 0.95rem;">
						${__(display_desc)}
					</p>
					${frm.doc.hr_override_note ? `<p style="margin: 4px 0 0 0; color: #718096; font-size: 0.85rem; font-style: italic;">${__("HR Note:")} ${frm.doc.hr_override_note}</p>` : ""}
				</div>
				<div style="text-align: right; min-width: 140px;">
					<div style="font-size: 2.2rem; font-weight: 800; color: ${border_color}; line-height: 1;">
						${frm.doc.total_score != null ? Math.round(frm.doc.total_score) : 0}
					</div>
					<div style="font-size: 0.8rem; text-transform: uppercase; color: #718096; letter-spacing: 0.5px; margin-top: 4px;">
						${__("Total Score")}
					</div>
				</div>
			</div>
		`;

		frm.dashboard.clear_headline();
		frm.dashboard.set_headline(html);

		// Event listener edit override button
		setTimeout(() => {
			$(".btn-override-label").off("click").on("click", function (e) {
				e.preventDefault();
				frm.trigger("show_override_modal");
			});
		}, 100);
	},

	show_override_modal(frm) {
		let d = new frappe.ui.Dialog({
			title: __("Edit Screening Result Label"),
			fields: [
				{
					label: __("HR Replacement Label"),
					fieldname: "hr_override_label",
					fieldtype: "Data",
					default: frm.doc.hr_override_label || frm.doc.result_label || "",
					description: __("Overrides display label without modifying actual score.")
				},
				{
					label: __("Reason / Note for Change"),
					fieldname: "hr_override_note",
					fieldtype: "Small Text",
					default: frm.doc.hr_override_note || ""
				}
			],
			primary_action_label: __("Save"),
			primary_action(values) {
				frm.set_value("hr_override_label", values.hr_override_label);
				frm.set_value("hr_override_note", values.hr_override_note);
				frm.save().then(() => {
					d.hide();
					frm.trigger("render_banner");
				});
			}
		});
		d.show();
	},

	setup_realtime_listener(frm) {
		if (frm._has_realtime_listener) return;
		frm._has_realtime_listener = true;

		frappe.realtime.on("resume_screening_progress", function (data) {
			if (data && data.screening === frm.doc.name) {
				if (data.status === "Done") {
					frappe.show_alert({
						message: __("Screening completed with score {0}", [data.total_score]),
						indicator: "green"
					});
					frm.reload_doc();
				} else {
					frm.dashboard.show_progress(
						__("Evaluating metric {0}...", [data.metric || ""]),
						data.progress || 50
					);
				}
			}
		});
	}
});
