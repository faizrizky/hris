// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Background Check Settings", {
	refresh: function (frm) {
		if (frappe.user.has_role("System Manager")) {
			frm.add_custom_button(__("Test Fetch"), function () {
				show_test_fetch_dialog(frm);
			});
		}
	}
});

function show_test_fetch_dialog(frm) {
	let d = new frappe.ui.Dialog({
		title: __("Test Profile Fetch"),
		fields: [
			{
				label: __("Test URL"),
				fieldname: "url",
				fieldtype: "Data",
				reqd: 1,
				description: __("Only public URLs starting with http:// or https://")
			},
			{
				label: __("I am the owner of this profile or have the owner's permission"),
				fieldname: "consent_acknowledged",
				fieldtype: "Check",
				reqd: 1
			},
			{
				fieldname: "results_html",
				fieldtype: "HTML"
			}
		],
		primary_action_label: __("Fetch"),
		primary_action: function (values) {
			if (!values.url || (!values.url.startsWith("http://") && !values.url.startsWith("https://"))) {
				frappe.msgprint(__("URL must start with http:// or https://."));
				return;
			}
			if (!values.consent_acknowledged) {
				frappe.msgprint(__("You must confirm profile ownership or permission before proceeding."));
				return;
			}

			d.get_primary_btn().prop("disabled", true).text(__("Fetching..."));
			d.fields_dict.results_html.$wrapper.html(
				`<div class="text-center py-4"><span class="spinner-border spinner-border-sm"></span> ${__("Testing fetch in 3 modes (Company, Browser, Stealth)...")}</div>`
			);

			frappe.call({
				method: "hris_ats.hris_ats.doctype.background_check_settings.background_check_settings.test_fetch",
				args: {
					url: values.url,
					consent_acknowledged: values.consent_acknowledged ? 1 : 0
				},
				callback: function (r) {
					d.get_primary_btn().prop("disabled", false).text(__("Fetch"));
					if (r.message && r.message.results) {
						render_test_fetch_results(d, r.message);
					}
				},
				error: function () {
					d.get_primary_btn().prop("disabled", false).text(__("Fetch"));
				}
			});
		}
	});

	d.show();
}

function render_test_fetch_results(dialog, data) {
	let wrapper = dialog.fields_dict.results_html.$wrapper;
	let html = `
		<div class="mt-3">
			<div class="small font-weight-bold mb-2 text-muted">
				${__("Target Domain")}: <code>${frappe.utils.escape_html(data.domain)}</code>
			</div>
			<div class="d-flex flex-column gap-3">
	`;

	data.results.forEach(res => {
		let badgeClass = res.status === 200 ? "badge-success" : (res.status === "Skipped" ? "badge-secondary" : "badge-danger");
		let isLoginBadge = res.is_login_page
			? `<span class="badge badge-warning ms-2" style="background-color: #feebc8; color: #7b341e; font-weight: 600; padding: 4px 8px; border-radius: 4px;">⚠️ ${__("Likely login page")}</span>`
			: "";

		html += `
			<div class="card p-3 border shadow-none">
				<div class="d-flex align-items-center justify-content-between mb-2">
					<div class="font-weight-bold">
						${__("Mode")}: <span class="badge badge-info">${frappe.utils.escape_html(res.mode)}</span>
						${isLoginBadge}
					</div>
					<div>
						<span class="badge ${badgeClass}" style="font-size: 0.85rem;">Status: ${frappe.utils.escape_html(String(res.status))}</span>
					</div>
				</div>
		`;

		if (res.message) {
			html += `<div class="small text-muted mb-1">${frappe.utils.escape_html(res.message)}</div>`;
		}
		if (res.error) {
			html += `<div class="small text-danger mb-1 font-weight-bold">${frappe.utils.escape_html(res.error)}</div>`;
		}
		if (res.final_url) {
			html += `<div class="small text-muted mb-1"><strong>Final URL:</strong> <code>${frappe.utils.escape_html(res.final_url)}</code></div>`;
		}
		if (res.mode_used) {
			html += `<div class="small text-muted mb-1"><strong>Mode used:</strong> ${frappe.utils.escape_html(res.mode_used)} | <strong>Size:</strong> ${res.size_bytes} bytes</div>`;
		}
		if (res.title) {
			html += `<div class="small text-dark mb-1"><strong>&lt;title&gt;:</strong> ${frappe.utils.escape_html(res.title)}</div>`;
		}
		if (res.preview_text) {
			html += `
				<div class="mt-2">
					<div class="small font-weight-bold text-muted mb-1">${__("First 300 characters of display text")}:</div>
					<div class="p-2 bg-light border rounded small text-monospace" style="white-space: pre-wrap; max-height: 100px; overflow-y: auto;">
						${frappe.utils.escape_html(res.preview_text)}
					</div>
				</div>
			`;
		}

		html += `</div>`;
	});

	html += `
			</div>
		</div>
	`;

	wrapper.html(html);
}
