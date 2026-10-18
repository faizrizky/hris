// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Background Check", {
	refresh(frm) {
		frm.trigger("render_banner");
		frm.trigger("setup_realtime_listener");
		frm.trigger("render_name_findings");
		frm.trigger("render_account_findings");

		if (!frm.is_new() && frm.doc.consent_status === "Granted" && frm.doc.status !== "Crawling") {
			frm.add_custom_button(__("Jalankan Ulang"), function () {
				frappe.confirm(
					__("Jalankan ulang pemeriksaan Background Check untuk kandidat ini?"),
					function () {
						frappe.call({
							method: "hris_ats.hris_ats.doctype.background_check.background_check.rerun_background_check",
							args: { bgc_name: frm.doc.name },
							freeze: true,
							freeze_message: __("Memulai ulang background check..."),
							callback: function (r) {
								if (r.message) {
									frappe.show_alert({
										message: r.message.message || __("Pemeriksaan ulang dijadwalkan"),
										indicator: "green"
									});
									frm.reload_doc();
								}
							}
						});
					}
				);
			}, __("Aksi"));
		}

		if (frm.doc.job_applicant) {
			frm.add_custom_button(__("Lihat Pelamar"), function () {
				frappe.set_route("Form", "Job Applicant", frm.doc.job_applicant);
			}, __("Navigasi"));
		}

		frm.add_custom_button(__("Buka List Finding"), function () {
			frappe.set_route("List", "Background Check Finding", { background_check: frm.doc.name });
		}, __("Navigasi"));
	},

	render_banner(frm) {
		if (frm.is_new()) return;

		let risk = frm.doc.risk_level_final || frm.doc.risk_level_auto || "Rendah";
		let color_map = {
			"Tinggi": { bg: "#fff5f5", border: "#e53e3e", text: "#9b2c2c" },
			"Perlu verifikasi": { bg: "#faf5ff", border: "#805ad5", text: "#553c9a" },
			"Sedang": { bg: "#fffaf0", border: "#dd6b20", text: "#9c4221" },
			"Rendah": { bg: "#f0fff4", border: "#38a169", text: "#22543d" }
		};

		let style = color_map[risk] || color_map["Rendah"];
		let is_final = !!frm.doc.risk_level_final;
		let badge_text = is_final ? __("Keputusan Final HR") : __("Indikasi Otomatis");

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
							Tingkat Risiko: ${risk}
						</span>
						<span class="badge ${is_final ? 'badge-primary' : 'badge-default'}" style="font-size: 0.75rem;">
							${badge_text}
						</span>
						<span class="badge badge-info" style="font-size: 0.75rem;">
							Status: ${frm.doc.status}
						</span>
					</div>
					<div style="margin-top: 6px; color: #4a5568; font-size: 0.9rem;">
						${frm.doc.summary_auto || __("Pemeriksaan belum dijalankan atau belum ada temuan.")}
					</div>
					${frm.doc.hr_conclusion ? `<div style="margin-top: 4px; font-weight: 600; color: #2d3748; font-size: 0.85rem;">Kesimpulan HR: ${frm.doc.hr_conclusion}</div>` : ""}
				</div>
				<div style="text-align: right; min-width: 140px;">
					<div style="font-size: 0.8rem; text-transform: uppercase; color: #718096;">
						Status Persetujuan
					</div>
					<div style="font-weight: 700; color: ${frm.doc.consent_status === 'Granted' ? '#38a169' : '#e53e3e'}; font-size: 1.1rem; margin-top: 2px;">
						${frm.doc.consent_status}
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
					message: __("Pemeriksaan Background Check selesai"),
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
							<p class="mb-0">${__("Tidak ada temuan artikel, dokumen, atau perkara hukum untuk kandidat ini.")}</p>
						</div>
					`);
					return;
				}

				let sev_color = {
					"Tinggi": "danger",
					"Sedang": "warning",
					"Rendah": "info",
					"Info": "secondary"
				};

				let rows_html = items.map(f => {
					let badge_cls = sev_color[f.severity] || "secondary";
					let link_html = f.url ? `<a href="${f.url}" target="_blank" style="margin-left: 8px;"><i class="fa fa-external-link"></i></a>` : "";

					return `
						<div class="card mb-3 p-3 border shadow-none finding-card" data-name="${f.name}">
							<div class="d-flex justify-content-between align-items-start mb-2">
								<div>
									<span class="badge badge-light mr-2">${f.finding_type}</span>
									<span class="badge badge-${badge_cls} mr-2">${f.severity}</span>
									<span class="badge badge-info mr-2">${f.category}</span>
									<strong style="font-size: 1rem; color: #2d3748;">${f.title}</strong>
									${link_html}
								</div>
								<div class="text-right" style="min-width: 180px;">
									<label class="small text-muted mb-1 d-block">HR Verdict:</label>
									<select class="form-control form-control-sm hr-verdict-select" data-name="${f.name}">
										<option value="Belum ditinjau" ${f.hr_verdict === 'Belum ditinjau' ? 'selected' : ''}>Belum ditinjau</option>
										<option value="Relevan" ${f.hr_verdict === 'Relevan' ? 'selected' : ''}>Relevan</option>
										<option value="Bukan orang ini" ${f.hr_verdict === 'Bukan orang ini' ? 'selected' : ''}>Bukan orang ini</option>
										<option value="Diabaikan" ${f.hr_verdict === 'Diabaikan' ? 'selected' : ''}>Diabaikan</option>
									</select>
								</div>
							</div>
							<p class="text-muted small mb-2" style="line-height: 1.5;">${f.snippet || '-'}</p>
							<div class="small text-secondary d-flex justify-content-between">
								<span><strong>Sumber:</strong> ${f.source_name || '-'} | <strong>Kecocokan Identitas:</strong> ${f.match_confidence}%</span>
								<span>${f.match_reasons || ''}</span>
							</div>
						</div>
					`;
				}).join("");

				let full_html = `
					<div class="findings-toolbar mb-3 d-flex justify-content-between align-items-center">
						<input type="text" class="form-control form-control-sm search-findings" placeholder="${__('Cari judul atau isi temuan...')}" style="max-width: 320px;">
						<span class="small text-muted">Total: ${items.length} temuan</span>
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
								frappe.show_alert({ message: __("Verdict diperbarui"), indicator: "green" });
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
							<p class="mb-0">${__("Tidak ada post publik yang terindikasi berisiko dari akun kandidat.")}</p>
						</div>
					`);
					return;
				}

				let posts_html = posts.map(p => `
					<div class="card mb-2 p-3 border border-warning shadow-none">
						<div class="d-flex justify-content-between align-items-center mb-1">
							<div>
								<span class="badge badge-danger mr-2">${p.severity}</span>
								<span class="small text-muted">${p.published_on || ''}</span>
							</div>
							<div style="min-width: 170px;">
								<select class="form-control form-control-sm hr-verdict-select" data-name="${p.name}">
									<option value="Belum ditinjau" ${p.hr_verdict === 'Belum ditinjau' ? 'selected' : ''}>Belum ditinjau</option>
									<option value="Relevan" ${p.hr_verdict === 'Relevan' ? 'selected' : ''}>Relevan</option>
									<option value="Bukan orang ini" ${p.hr_verdict === 'Bukan orang ini' ? 'selected' : ''}>Bukan orang ini</option>
									<option value="Diabaikan" ${p.hr_verdict === 'Diabaikan' ? 'selected' : ''}>Diabaikan</option>
								</select>
							</div>
						</div>
						<p class="mb-1" style="font-style: italic;">"${p.snippet}"</p>
						<div class="small text-danger">
							<strong>Indikasi Risiko:</strong> ${p.risk_flags || '-'}
						</div>
					</div>
				`).join("");

				container.html(`
					<div class="mb-3">
						<h6 class="text-uppercase text-secondary font-weight-bold mb-2">${__("Post Terindikasi Berisiko")}</h6>
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
								frappe.show_alert({ message: __("Verdict diperbarui"), indicator: "green" });
								frm.reload_doc();
							}
						}
					});
				});
			}
		});
	}
});
