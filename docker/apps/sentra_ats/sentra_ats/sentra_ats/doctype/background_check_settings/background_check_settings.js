// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Background Check Settings", {
	refresh: function (frm) {
		if (frappe.user.has_role("System Manager")) {
			frm.add_custom_button(__("Test Fetch"), function () {
				show_test_fetch_dialog(frm);
			});
			frm.add_custom_button(__("Test Crawl"), function () {
				frappe.set_route("bgc-crawl-test");
			});
		}

		if (frm.doc.fetch_browser_status && frm.fields_dict.fetch_browser_status) {
			let disp = frm.fields_dict.fetch_browser_status.$wrapper.find(".control-value");
			if (disp.length) {
				disp.text(__(frm.doc.fetch_browser_status));
			}
		}

		if (frm.fields_dict.crawler_accounts_html) {
			render_crawler_accounts_table(frm);
		}
	},
	fetch_use_login_session: function (frm) {
		if (frm.doc.fetch_use_login_session && !frm.doc.fetch_risk_acknowledged) {
			frappe.msgprint({
				title: __("Risk Acknowledgment Required"),
				message: __("Enabling crawler login sessions requires acknowledging legal and technical risks."),
				indicator: "orange"
			});
		}
	},
	fetch_auto_escalate: function (frm) {
		if (frm.doc.fetch_auto_escalate && !frm.doc.fetch_risk_acknowledged) {
			frappe.msgprint({
				title: __("Risk Acknowledgment Required"),
				message: __("Enabling auto-escalation of fetch modes requires acknowledging legal and technical risks."),
				indicator: "orange"
			});
		}
	},
	test_fetch_btn: function (frm) {
		if (frappe.user.has_role("System Manager")) {
			show_test_fetch_dialog(frm);
		} else {
			frappe.msgprint(__("Only System Manager can perform test fetch."));
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
				method: "sentra_ats.sentra_ats.doctype.background_check_settings.background_check_settings.test_fetch",
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

		if (res.account_label) {
			html += `<div class="small text-muted mb-1"><strong>${__("Crawler Account")}:</strong> ${frappe.utils.escape_html(res.account_label)}</div>`;
		}
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
		if (res.og_title) {
			html += `<div class="small text-muted mb-1"><strong>og:title:</strong> ${frappe.utils.escape_html(res.og_title)}</div>`;
		}
		if (res.og_description) {
			html += `<div class="small text-muted mb-1"><strong>og:description:</strong> ${frappe.utils.escape_html(res.og_description)}</div>`;
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
		if (res.comparison_with_browser) {
			let cmp = res.comparison_with_browser;
			html += `
				<div class="mt-3 border rounded p-2 bg-light">
					<div class="small font-weight-bold text-dark mb-1">📊 ${__("Comparison: Session vs Browser Mode (Without Session)")}:</div>
					<table class="table table-sm table-bordered bg-white mb-0 small">
						<thead>
							<tr class="table-light">
								<th>${__("Profile Attribute")}</th>
								<th>${__("Browser Mode (No Session)")}</th>
								<th>${__("Session Mode")}</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>${__("Name detected")}</td>
								<td>${cmp.has_name.browser ? "✅ " + __("Yes") : "❌ " + __("No")}</td>
								<td>${cmp.has_name.session ? "✅ " + __("Yes") : "❌ " + __("No")}</td>
							</tr>
							<tr>
								<td>${__("Bio detected")}</td>
								<td>${cmp.has_bio.browser ? "✅ " + __("Yes") : "❌ " + __("No")}</td>
								<td>${cmp.has_bio.session ? "✅ " + __("Yes") : "❌ " + __("No")}</td>
							</tr>
							<tr>
								<td>${__("Followers detected")}</td>
								<td>${cmp.has_followers.browser ? "✅ " + __("Yes") : "❌ " + __("No")}</td>
								<td>${cmp.has_followers.session ? "✅ " + __("Yes") : "❌ " + __("No")}</td>
							</tr>
							<tr>
								<td>${__("Visible Posts Count")}</td>
								<td><code>${cmp.posts_count.browser}</code></td>
								<td><code>${cmp.posts_count.session}</code></td>
							</tr>
						</tbody>
					</table>
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

function render_crawler_accounts_table(frm) {
	let wrapper = frm.fields_dict.crawler_accounts_html.$wrapper;
	wrapper.html(`<div class="text-center py-3 text-muted"><span class="spinner-border spinner-border-sm"></span> ${__("Loading crawler accounts...")}</div>`);

	frappe.call({
		method: "sentra_ats.bgc.crawler_session.get_crawler_accounts_list",
		callback: function (r) {
			let accounts = r.message || [];
			let can_edit = frappe.user.has_role("System Manager");

			let html = `
				<div class="crawler-accounts-container border rounded p-3 bg-white">
					<div class="d-flex align-items-center justify-content-between mb-3">
						<div>
							<h6 class="mb-0 font-weight-bold">${__("Configured Crawler Accounts")}</h6>
							<small class="text-muted">${__("Dedicated company accounts used to access restricted social profile views.")}</small>
						</div>
						${can_edit ? `
							<button type="button" class="btn btn-xs btn-primary btn-add-crawler">
								<i class="fa fa-plus me-1"></i> ${__("Add Crawler Account")}
							</button>
						` : ""}
					</div>
			`;

			if (!accounts.length) {
				html += `
					<div class="text-center py-4 border rounded bg-light text-muted">
						<i class="fa fa-users fa-2x mb-2 text-secondary"></i>
						<div>${__("No crawler accounts configured.")}</div>
						${can_edit ? `<div class="small mt-1">${__("Click 'Add Crawler Account' to set up an account per platform.")}</div>` : ""}
					</div>
				`;
			} else {
				html += `
					<div class="table-responsive">
						<table class="table table-bordered table-sm mb-0">
							<thead class="thead-light">
								<tr>
									<th>${__("Platform")}</th>
									<th>${__("Account Label")}</th>
									<th>${__("Account Handle")}</th>
									<th>${__("Status")}</th>
									<th>${__("Last Login")}</th>
									<th>${__("Last Used")}</th>
									<th>${__("Session Expiry")}</th>
									${can_edit ? `<th style="width: 180px;">${__("Actions")}</th>` : ""}
								</tr>
							</thead>
							<tbody>
				`;

				accounts.forEach(acc => {
					let statusBadgeClass = "badge-secondary";
					let statusIcon = "";
					if (acc.status === "Connected") {
						statusBadgeClass = "badge-success";
						statusIcon = "✅ ";
					} else if (acc.status === "Challenge") {
						statusBadgeClass = "badge-warning";
						statusIcon = "⚠️ ";
					} else if (acc.status === "Expired") {
						statusBadgeClass = "badge-danger";
						statusIcon = "⏱️ ";
					} else if (acc.status === "Disabled") {
						statusBadgeClass = "badge-dark";
					}

					let connectedOn = acc.connected_on ? frappe.datetime.str_to_user(acc.connected_on) : "-";
					let lastUsed = acc.last_used_on ? frappe.datetime.str_to_user(acc.last_used_on) : "-";
					let expiresOn = acc.session_expires_on ? frappe.datetime.str_to_user(acc.session_expires_on) : "-";

					html += `
						<tr data-name="${frappe.utils.escape_html(acc.name)}">
							<td><strong>${frappe.utils.escape_html(acc.platform)}</strong></td>
							<td><a href="/app/background-check-crawler-account/${encodeURIComponent(acc.name)}">${frappe.utils.escape_html(acc.account_label)}</a></td>
							<td><code>${frappe.utils.escape_html(acc.account_handle || "-")}</code></td>
							<td><span class="badge ${statusBadgeClass}">${statusIcon}${__(acc.status)}</span></td>
							<td class="small text-muted">${connectedOn}</td>
							<td class="small text-muted">${lastUsed}</td>
							<td class="small text-muted">${expiresOn}</td>
							${can_edit ? `
								<td>
									<div class="btn-group btn-group-sm">
										${acc.status === "Connected" ? `
											<button type="button" class="btn btn-default btn-xs btn-test-session" data-name="${frappe.utils.escape_html(acc.name)}" title="${__("Test Session")}">
												${__("Test Session")}
											</button>
											<button type="button" class="btn btn-danger btn-xs btn-disconnect-session" data-name="${frappe.utils.escape_html(acc.name)}" title="${__("Disconnect")}">
												${__("Disconnect")}
											</button>
										` : `
											<button type="button" class="btn btn-primary btn-xs btn-login-session" data-name="${frappe.utils.escape_html(acc.name)}" data-risk="${acc.risk_acknowledged ? 1 : 0}">
												<i class="fa fa-sign-in me-1"></i> ${__("Login")}
											</button>
										`}
									</div>
								</td>
							` : ""}
						</tr>
					`;
				});

				html += `
							</tbody>
						</table>
					</div>
				`;
			}

			html += `</div>`;
			wrapper.html(html);

			// Attach event handlers
			wrapper.find(".btn-add-crawler").on("click", function () {
				frappe.new_doc("Background Check Crawler Account");
			});

			wrapper.find(".btn-login-session").on("click", function () {
				let accName = $(this).data("name");
				let riskAck = $(this).data("risk");
				if (!riskAck) {
					frappe.msgprint({
						title: __("Risk Acknowledgment Required"),
						message: __("You must open the Crawler Account record and check 'Acknowledge Legal and Technical Risks' before initiating interactive login."),
						indicator: "orange"
					});
					return;
				}
				if (typeof sentra_ats !== "undefined" && sentra_ats.show_crawler_login_dialog) {
					sentra_ats.show_crawler_login_dialog(accName, function () {
						render_crawler_accounts_table(frm);
					});
				} else {
					frappe.require("/assets/sentra_ats/js/crawler_login_dialog.js", function () {
						sentra_ats.show_crawler_login_dialog(accName, function () {
							render_crawler_accounts_table(frm);
						});
					});
				}
			});

			wrapper.find(".btn-test-session").on("click", function () {
				let accName = $(this).data("name");
				let btn = $(this).prop("disabled", true).text(__("Testing..."));
				frappe.call({
					method: "sentra_ats.bgc.crawler_session.test_account_session",
					args: { account_name: accName },
					callback: function (res) {
						btn.prop("disabled", false).text(__("Test Session"));
						if (res.message) {
							frappe.msgprint({
								title: __("Session Status"),
								message: res.message.message,
								indicator: res.message.status === "Connected" ? "green" : "red"
							});
							render_crawler_accounts_table(frm);
						}
					},
					error: function () {
						btn.prop("disabled", false).text(__("Test Session"));
					}
				});
			});

			wrapper.find(".btn-disconnect-session").on("click", function () {
				let accName = $(this).data("name");
				frappe.confirm(
					__("Are you sure you want to disconnect this crawler account? Stored session credentials will be permanently erased."),
					function () {
						frappe.call({
							method: "sentra_ats.bgc.crawler_session.disconnect_account",
							args: { account_name: accName },
							freeze: true,
							callback: function () {
								frappe.show_alert({
									message: __("Crawler account disconnected."),
									indicator: "info"
								});
								render_crawler_accounts_table(frm);
							}
						});
					}
				);
			});
		}
	});
}
