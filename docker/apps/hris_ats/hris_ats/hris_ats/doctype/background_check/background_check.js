// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Background Check", {
	refresh(frm) {
		frm.trigger("render_banner");
		frm.trigger("setup_realtime_listener");
		frm.trigger("render_name_findings");
		frm.trigger("render_account_findings");

		if (!frm.is_new() && frm.doc.consent_status === "Granted" && frm.doc.status !== "Crawling") {
			frm.add_custom_button(__("Rerun"), function () {
				frappe.confirm(
					__("Rerun background check for this candidate?"),
					function () {
						frappe.call({
							method: "hris_ats.hris_ats.doctype.background_check.background_check.rerun_background_check",
							args: { bgc_name: frm.doc.name },
							freeze: true,
							freeze_message: __("Restarting background check..."),
							callback: function (r) {
								if (r.message) {
									frappe.show_alert({
										message: r.message.message || __("Rerun scheduled"),
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

		if (frm.doc.job_applicant) {
			frm.add_custom_button(__("View Applicant"), function () {
				frappe.set_route("Form", "Job Applicant", frm.doc.job_applicant);
			}, __("Navigation"));
		}

		frm.add_custom_button(__("Open Findings List"), function () {
			frappe.set_route("List", "Background Check Finding", { background_check: frm.doc.name });
		}, __("Navigation"));
	},

	render_banner(frm) {
		if (frm.is_new()) return;

		let risk = frm.doc.risk_level_final || frm.doc.risk_level_auto || "Low";
		let color_map = {
			"High": { bg: "#fff5f5", border: "#e53e3e", text: "#9b2c2c" },
			"Tinggi": { bg: "#fff5f5", border: "#e53e3e", text: "#9b2c2c" },
			"Needs verification": { bg: "#faf5ff", border: "#805ad5", text: "#553c9a" },
			"Perlu verifikasi": { bg: "#faf5ff", border: "#805ad5", text: "#553c9a" },
			"Medium": { bg: "#fffaf0", border: "#dd6b20", text: "#9c4221" },
			"Sedang": { bg: "#fffaf0", border: "#dd6b20", text: "#9c4221" },
			"Low": { bg: "#f0fff4", border: "#38a169", text: "#22543d" },
			"Rendah": { bg: "#f0fff4", border: "#38a169", text: "#22543d" }
		};

		let style = color_map[risk] || color_map["Low"];
		let is_final = !!frm.doc.risk_level_final;
		let badge_text = is_final ? __("Final HR Decision") : __("Automated Indication");

		let html = `
			<div class="bgc-banner" style="
				background-color: ${style.bg};
				border-left: 6px solid ${style.border};
				padding: 16px 20px;
				margin-bottom: 20px;
				border-radius: 6px;
				display: flex;
				justify-content: space-between;
				align-items: center;
			">
				<div>
					<div style="display: flex; align-items: center; gap: 10px;">
						<span style="font-size: 1.25rem; font-weight: 700; color: ${style.text};">
							${__("Risk Level")}: ${__(risk)}
						</span>
						<span class="badge ${is_final ? 'badge-primary' : 'badge-default'}" style="font-size: 0.75rem;">
							${badge_text}
						</span>
						<span class="badge badge-info" style="font-size: 0.75rem;">
							${__("Status")}: ${__(frm.doc.status)}
						</span>
					</div>
					<div style="margin-top: 6px; color: #4a5568; font-size: 0.9rem;">
						${frm.doc.summary_auto || __("Screening has not been executed or no findings recorded.")}
					</div>
					${frm.doc.hr_conclusion ? `<div style="margin-top: 4px; font-weight: 600; color: #2d3748; font-size: 0.85rem;">${__("HR Conclusion")}: ${frm.doc.hr_conclusion}</div>` : ""}
				</div>
				<div style="text-align: right; min-width: 140px;">
					<div style="font-size: 0.8rem; text-transform: uppercase; color: #718096;">
						${__("Consent Status")}
					</div>
					<div style="font-weight: 700; color: ${frm.doc.consent_status === 'Granted' ? '#38a169' : '#e53e3e'}; font-size: 1.1rem; margin-top: 2px;">
						${__(frm.doc.consent_status)}
					</div>
				</div>
			</div>
		`;

		frm.dashboard.clear_headline();
		frm.dashboard.set_headline(html);
	},

	setup_realtime_listener(frm) {
		if (frm.is_new()) return;
		frappe.realtime.off("bgc_source_progress");
		frappe.realtime.on("bgc_source_progress", function (data) {
			if (data && data.bgc === frm.doc.name) {
				frm.reload_doc();
			}
		});

		frappe.realtime.off("bgc_completed");
		frappe.realtime.on("bgc_completed", function (data) {
			if (data && data.bgc === frm.doc.name) {
				frappe.show_alert({
					message: __("Background Check completed"),
					indicator: "green"
				});
				frm.reload_doc();
			}
		});
	},

	render_name_findings(frm) {
		if (frm.is_new() || !frm.fields_dict.name_findings_html) return;

		frappe.call({
			method: "hris_ats.hris_ats.doctype.background_check.background_check.get_findings_data",
			args: { bgc_name: frm.doc.name },
			callback: function (r) {
				if (!r.message) return;
				let items = r.message.name_findings || [];
				let container = frm.fields_dict.name_findings_html.$wrapper;
				container.empty();

				if (!items.length) {
					container.html(`
						<div class="text-center text-muted p-4 border rounded bg-light">
							<p class="mb-0">${__("No article, document, or legal case findings for this candidate.")}</p>
						</div>
					`);
					return;
				}

				let sev_color = {
					"High": "danger",
					"Tinggi": "danger",
					"Medium": "warning",
					"Sedang": "warning",
					"Low": "info",
					"Rendah": "info",
					"Info": "secondary"
				};

				let rows_html = items.map(f => {
					let badge_cls = sev_color[f.severity] || "secondary";
					let link_html = f.url ? `<a href="${f.url}" target="_blank" style="margin-left: 8px;"><i class="fa fa-external-link"></i></a>` : "";
					let detail_btn = f.detail_url ? `<a href="${f.detail_url}" target="_blank" class="btn btn-xs btn-default ml-2"><i class="fa fa-info-circle mr-1"></i>${__("Detail Page")}</a>` : "";
					let pdf_btn = f.pdf_url ? `<a href="${f.pdf_url}" target="_blank" class="btn btn-xs btn-primary ml-2"><i class="fa fa-file-pdf-o mr-1"></i>${__("Download PDF Copy")}</a>` : "";
					let text_src_badge = f.text_source ? `<span class="badge badge-light border mr-2" title="${__('Text Source')}"><i class="fa fa-file-text-o mr-1"></i>${__(f.text_source)}</span>` : "";

					let v = f.hr_verdict || "Not reviewed";
					return `
						<div class="card mb-3 p-3 border shadow-none finding-card" data-name="${f.name}">
							<div class="d-flex justify-content-between align-items-start mb-2">
								<div>
									<span class="badge badge-light mr-2">${__(f.finding_type)}</span>
									<span class="badge badge-${badge_cls} mr-2">${__(f.severity)}</span>
									<span class="badge badge-info mr-2">${__(f.category)}</span>
									${text_src_badge}
									<strong style="font-size: 1rem; color: #2d3748;">${f.title}</strong>
									${link_html}
								</div>
								<div class="text-right" style="min-width: 180px;">
									<label class="small text-muted mb-1 d-block">${__("HR Verdict:")}</label>
									<select class="form-control form-control-sm hr-verdict-select" data-name="${f.name}">
										<option value="Not reviewed" ${v === 'Not reviewed' || v === 'Belum ditinjau' ? 'selected' : ''}>${__("Not reviewed")}</option>
										<option value="Relevant" ${v === 'Relevant' || v === 'Relevan' ? 'selected' : ''}>${__("Relevant")}</option>
										<option value="Not this person" ${v === 'Not this person' || v === 'Bukan orang ini' ? 'selected' : ''}>${__("Not this person")}</option>
										<option value="Ignored" ${v === 'Ignored' || v === 'Diabaikan' ? 'selected' : ''}>${__("Ignored")}</option>
									</select>
								</div>
							</div>
							<p class="text-muted small mb-2" style="line-height: 1.5;">${f.snippet || '-'}</p>
							${f.evidence_excerpt ? `
								<div class="p-2 mb-2 bg-light border-left border-primary rounded small text-dark" style="font-style: italic; background-color: #f7fafc;">
									<strong>${__("Evidence Excerpt")} (${__(f.text_source || 'Snippet')}):</strong> "${f.evidence_excerpt}"
								</div>
							` : ''}
							<div class="small text-secondary d-flex justify-content-between align-items-center flex-wrap">
								<span>
									<strong>${__("Source")}:</strong> ${f.source_name || '-'} |
									<strong>${__("Identity Match")}:</strong> <span class="badge ${f.match_confidence >= 80 ? 'badge-success' : (f.match_confidence >= 50 ? 'badge-warning' : 'badge-danger')}">${f.match_confidence}%</span>
									${detail_btn}
									${pdf_btn}
								</span>
								<span class="text-muted">${f.match_reasons || ''}</span>
							</div>
						</div>
					`;
				}).join("");

				let full_html = `
					<div class="findings-toolbar mb-3 d-flex justify-content-between align-items-center">
						<input type="text" class="form-control form-control-sm search-findings" placeholder="${__('Search title or finding snippet...')}" style="max-width: 320px;">
						<span class="small text-muted">${__("Total:")} ${items.length} ${__("findings")}</span>
					</div>
					<div class="findings-list">${rows_html}</div>
				`;

				container.html(full_html);

				// Handler search
				container.find(".search-findings").on("input", function () {
					let q = $(this).val().toLowerCase();
					container.find(".finding-card").each(function () {
						let text = $(this).text().toLowerCase();
						$(this).toggle(text.indexOf(q) !== -1);
					});
				});

				// Handler update verdict
				container.find(".hr-verdict-select").on("change", function () {
					let f_name = $(this).data("name");
					let val = $(this).val();
					frappe.call({
						method: "hris_ats.hris_ats.doctype.background_check.background_check.update_finding_verdict",
						args: { finding_name: f_name, verdict: val },
						callback: function (r) {
							if (r.message && r.message.success) {
								frappe.show_alert({ message: __("Verdict updated"), indicator: "green" });
								frm.reload_doc();
							}
						}
					});
				});
			}
		});
	},

	render_account_findings(frm) {
		if (frm.is_new() || !frm.fields_dict.account_findings_html) return;

		frappe.call({
			method: "hris_ats.hris_ats.doctype.background_check.background_check.get_findings_data",
			args: { bgc_name: frm.doc.name },
			callback: function (r) {
				if (!r.message) return;
				let posts = r.message.post_findings || [];
				let container = frm.fields_dict.account_findings_html.$wrapper;
				container.empty();

				if (!posts.length) {
					container.html(`
						<div class="text-center text-muted p-4 border rounded bg-light">
							<p class="mb-0">${__("No public posts flagged as risky from candidate accounts.")}</p>
						</div>
					`);
					return;
				}

				let posts_html = posts.map(p => {
					let v = p.hr_verdict || "Not reviewed";
					return `
						<div class="card mb-2 p-3 border border-warning shadow-none">
							<div class="d-flex justify-content-between align-items-center mb-1">
								<div>
									<span class="badge badge-danger mr-2">${__(p.severity)}</span>
									<span class="small text-muted">${p.published_on || ''}</span>
								</div>
								<div style="min-width: 170px;">
									<select class="form-control form-control-sm hr-verdict-select" data-name="${p.name}">
										<option value="Not reviewed" ${v === 'Not reviewed' || v === 'Belum ditinjau' ? 'selected' : ''}>${__("Not reviewed")}</option>
										<option value="Relevant" ${v === 'Relevant' || v === 'Relevan' ? 'selected' : ''}>${__("Relevant")}</option>
										<option value="Not this person" ${v === 'Not this person' || v === 'Bukan orang ini' ? 'selected' : ''}>${__("Not this person")}</option>
										<option value="Ignored" ${v === 'Ignored' || v === 'Diabaikan' ? 'selected' : ''}>${__("Ignored")}</option>
									</select>
								</div>
							</div>
							<p class="mb-1" style="font-style: italic;">"${p.snippet}"</p>
							<div class="small text-danger">
								<strong>${__("Risk Indicator")}:</strong> ${p.risk_flags || '-'}
							</div>
						</div>
					`;
				}).join("");

				container.html(`
					<div class="mb-3">
						<h6 class="text-uppercase text-secondary font-weight-bold mb-2">${__("Posts Flagged as Risky")}</h6>
						${posts_html}
					</div>
				`);

				// Handler update verdict on post findings
				container.find(".hr-verdict-select").on("change", function () {
					let f_name = $(this).data("name");
					let val = $(this).val();
					frappe.call({
						method: "hris_ats.hris_ats.doctype.background_check.background_check.update_finding_verdict",
						args: { finding_name: f_name, verdict: val },
						callback: function (r) {
							if (r.message && r.message.success) {
								frappe.show_alert({ message: __("Verdict updated"), indicator: "green" });
								frm.reload_doc();
							}
						}
					});
				});
			}
		});
	}
});
