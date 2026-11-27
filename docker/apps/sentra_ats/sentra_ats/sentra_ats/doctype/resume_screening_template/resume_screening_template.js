// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

// Regulated professions (blueprint): a licence/degree keyword that must appear in the CV
const KNOCKOUT_PRESETS = [
	{ label: __("Finance / Audit"), value: "Akuntansi, Brevet, CPA" },
	{ label: __("Engineering / Architecture"), value: "S.T., SKA, Ir." },
	{ label: __("Health / Medical"), value: "dr., apt., STR" },
	{ label: __("Legal / Compliance"), value: "S.H., Peradi" },
	{ label: __("HSE / K3"), value: "Ahli K3" },
];

const WEIGHT_TOTAL = 100;

frappe.ui.form.on("Resume Screening Template", {
	refresh(frm) {
		frm.trigger("calculate_total_weight");
		frm.add_custom_button(__("Simulate with a CV"), () => show_simulation_dialog(frm));
		if (!frm.is_new()) {
			frm.add_custom_button(__("Clone"), () => clone_template(frm));
		}
		frm.add_custom_button(__("Distribute remaining weight"), () => distribute_remaining_weight(frm), __("Weights"));
		KNOCKOUT_PRESETS.forEach((preset) => {
			frm.add_custom_button(preset.label, () => add_knockout_preset(frm, preset), __("Add Knock-Out Preset"));
		});
	},

	calculate_total_weight(frm) {
		const total = enabled_weight_total(frm);
		frm.set_value("total_weight", total);
		const remaining = Math.round((WEIGHT_TOTAL - total) * 100) / 100;
		let message;
		if (Math.abs(remaining) < 0.001) {
			message = `<span style="color: var(--green-600);">${__("Total weight is exactly 100%.")}</span>`;
		} else if (remaining > 0) {
			message = `<span style="color: var(--red-600);">${__("Total is {0}%: {1}% still to assign. Use Weights > Distribute remaining weight, or raise a metric.", [total, remaining])}</span>`;
		} else {
			message = `<span style="color: var(--red-600);">${__("Total is {0}%: {1}% over. Lower a metric before saving.", [total, -remaining])}</span>`;
		}
		frm.set_df_property("total_weight", "description", message);
	},
});

frappe.ui.form.on("Resume Screening Metric Weight", {
	weight(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		// The most this row may have so the active total does not pass 100
		const others = enabled_weight_total(frm) - (row.enabled ? flt(row.weight) : 0);
		const max_allowed = Math.max(0, WEIGHT_TOTAL - others);
		if (row.enabled && flt(row.weight) > max_allowed) {
			frappe.show_alert({ message: __("{0} can be at most {1}% (other metrics already use {2}%).", [__(row.metric), max_allowed, others]), indicator: "orange" });
		}
		frm.trigger("calculate_total_weight");
	},
	enabled(frm) {
		frm.trigger("calculate_total_weight");
	},
	metric_weights_remove(frm) {
		frm.trigger("calculate_total_weight");
	},
});

function enabled_weight_total(frm) {
	const total = (frm.doc.metric_weights || []).filter((r) => r.enabled).reduce((sum, r) => sum + flt(r.weight), 0);
	return Math.round(total * 100) / 100;
}

function distribute_remaining_weight(frm) {
	const rows = (frm.doc.metric_weights || []).filter((r) => r.enabled);
	const remaining = WEIGHT_TOTAL - enabled_weight_total(frm);
	if (!rows.length || Math.abs(remaining) < 0.001) {
		frappe.show_alert({ message: __("Nothing to distribute."), indicator: "blue" });
		return;
	}
	if (remaining < 0) {
		frappe.msgprint(__("The total is over 100%. Lower a metric first."));
		return;
	}
	const current = rows.reduce((sum, r) => sum + flt(r.weight), 0);
	// Proportional to the weights already set; evenly when they are all zero
	rows.forEach((r) => {
		const share = current > 0 ? (flt(r.weight) / current) * remaining : remaining / rows.length;
		r.weight = Math.round((flt(r.weight) + share) * 100) / 100;
	});
	// Rounding leftovers go to the largest weight so the total is exactly 100
	const drift = Math.round((WEIGHT_TOTAL - rows.reduce((sum, r) => sum + flt(r.weight), 0)) * 100) / 100;
	if (drift) {
		const largest = rows.reduce((a, b) => (flt(b.weight) > flt(a.weight) ? b : a));
		largest.weight = Math.round((flt(largest.weight) + drift) * 100) / 100;
	}
	frm.refresh_field("metric_weights");
	frm.dirty();
	frm.trigger("calculate_total_weight");
}

function add_knockout_preset(frm, preset) {
	frm.add_child("knockout_rules", {
		enabled: 1,
		condition: "Required keyword",
		value: preset.value,
		match: "Any",
		action: "Cap score",
		cap_score: 60,
		description: __("{0}: required licence or degree", [preset.label]),
	});
	frm.refresh_field("knockout_rules");
	frm.scroll_to_field("knockout_rules");
}

function clone_template(frm) {
	frappe.prompt(
		{ fieldname: "template_name", fieldtype: "Data", label: __("New template name"), reqd: 1, default: __("{0} (copy)", [frm.doc.template_name]) },
		(values) => {
			const copy = frappe.model.copy_doc(frm.doc);
			copy.template_name = values.template_name;
			// A designation can belong to one active template only
			copy.job_roles = [];
			frappe.set_route("Form", "Resume Screening Template", copy.name);
		},
		__("Clone Template"),
		__("Clone"),
	);
}

function show_simulation_dialog(frm) {
	const dialog = new frappe.ui.Dialog({
		title: __("Simulate with a CV"),
		size: "large",
		fields: [
			{ fieldtype: "HTML", fieldname: "intro", options: `<p class="text-muted">${__("Scores one sample CV with the rules on this form, including unsaved changes. The file is deleted afterwards and nothing is stored.")}</p>` },
			{ fieldtype: "Link", fieldname: "job_opening", label: __("Job Opening (criteria)"), options: "Job Opening", description: __("Optional: the skills, education and experience criteria to score against.") },
			{ fieldtype: "Attach", fieldname: "file_url", label: __("Sample CV (PDF or DOCX)"), reqd: 1, options: { restrictions: { allowed_file_types: [".pdf", ".docx"] } } },
			{ fieldtype: "HTML", fieldname: "result" },
		],
		primary_action_label: __("Run simulation"),
		primary_action(values) {
			dialog.fields_dict.result.$wrapper.html(`<div class="text-muted">${__("Scoring...")}</div>`);
			frappe
				.xcall("sentra_ats.sentra_ats.doctype.resume_screening_template.resume_screening_template.simulate_template", {
					template_doc: JSON.stringify(frm.doc),
					file_url: values.file_url,
					job_opening: values.job_opening || null,
				})
				.then((result) => {
					dialog.fields_dict.result.$wrapper.html(render_simulation(result, frm.doc.hide_penalty_points));
					dialog.set_value("file_url", "");
				})
				.catch(() => dialog.fields_dict.result.$wrapper.empty());
		},
	});
	dialog.show();
}

function review_text(r) {
	let messages = {};
	try {
		messages = JSON.parse(r.message_data || "{}");
	} catch (e) {
		messages = {};
	}
	const m = messages.review;
	return m ? sentra_ats.translate_message(m.reason_template, m.reason_params, r.review_reason) : __(r.review_reason || r.error || "");
}

function render_simulation(r, hide_points) {
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	if (r.status !== "Done") {
		return `<div class="alert alert-warning">${esc(__("Needs Manual Review"))}: ${esc(review_text(r))}</div>`;
	}
	const rules = (r.rule_results || [])
		.map((x) => {
			const points = hide_points && x.rule_type === "Penalty" ? (x.triggered ? __("On") : "-") : x.points ? x.points : "-";
			return `<tr class="${x.triggered ? "" : "text-muted"}"><td>${esc(__(x.rule_type))}</td><td>${esc(x.rule_type === "Penalty" ? __(x.rule) : x.rule)}</td><td>${x.triggered ? "✓" : ""}</td><td>${esc(points)}</td><td>${esc(sentra_ats.translate_message(x.reason_template, x.reason_params, x.reason))}${x.evidence ? `<div class="small text-muted">${esc(x.evidence)}</div>` : ""}</td></tr>`;
		})
		.join("");
	const metrics = (r.results || [])
		.filter((m) => m.original_weight > 0)
		.map((m) => `<tr><td>${esc(__(m.metric))}</td><td>${esc(m.score)}</td><td>${m.applicable ? esc(m.weight) + "%" : __("N/A")}</td><td>${esc(sentra_ats.translate_message(m.reason_template, m.reason_params, m.reason))}</td></tr>`)
		.join("");
	return `
		<div class="mb-3">
			<span class="indicator-pill ${esc(r.result_indicator)}">${esc(r.result_label)}</span>
			<b class="ml-2">${esc(r.total_score)}</b> / 100
			<span class="text-muted ml-2">${__("Base")} ${esc(r.base_score)}${hide_points ? "" : `, ${__("penalties")} ${esc(r.penalty_points)}`}</span>
			<span class="text-muted ml-2">${__("Reading confidence")}: ${esc(__(r.confidence))}</span>
			${r.needs_hr_review ? `<span class="indicator-pill orange ml-2">${__("Needs HR review")}</span>` : ""}
		</div>
		<h6>${__("Metrics")}</h6>
		<table class="table table-sm table-bordered"><thead><tr><th>${__("Metric")}</th><th>${__("Score")}</th><th>${__("Weight")}</th><th>${__("Reason")}</th></tr></thead><tbody>${metrics || `<tr><td colspan="4">-</td></tr>`}</tbody></table>
		<h6>${__("Rules")}</h6>
		<table class="table table-sm table-bordered"><thead><tr><th>${__("Type")}</th><th>${__("Rule")}</th><th>${__("Triggered")}</th><th>${__("Points")}</th><th>${__("Reason")}</th></tr></thead><tbody>${rules || `<tr><td colspan="5">-</td></tr>`}</tbody></table>`;
}
