// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Background Check Crawler Account", {
	refresh: function (frm) {
		if (frm.is_new()) return;

		if (frappe.user.has_role("System Manager")) {
			if (frm.doc.status === "Connected") {
				frm.add_custom_button(__("Test Session"), function () {
					frappe.call({
						method: "sentra_ats.bgc.crawler_session.test_account_session",
						args: { account_name: frm.doc.name },
						freeze: true,
						freeze_message: __("Testing crawler account session..."),
						callback: function (r) {
							if (r.message) {
								frm.reload_doc();
								frappe.msgprint({
									title: __("Session Status"),
									message: r.message.message,
									indicator: r.message.status === "Connected" ? "green" : "red"
								});
							}
						}
					});
				});

				frm.add_custom_button(__("Disconnect"), function () {
					frappe.confirm(
						__("Are you sure you want to disconnect this crawler account? Stored session credentials will be permanently erased."),
						function () {
							frappe.call({
								method: "sentra_ats.bgc.crawler_session.disconnect_account",
								args: { account_name: frm.doc.name },
								freeze: true,
								callback: function () {
									frm.reload_doc();
									frappe.show_alert({
										message: __("Crawler account disconnected."),
										indicator: "info"
									});
								}
							});
						}
					);
				});
			} else {
				let login_btn = frm.add_custom_button(__("Login"), function () {
					if (!frm.doc.risk_acknowledged) {
						frappe.msgprint({
							title: __("Risk Acknowledgment Required"),
							message: __("You must check 'Acknowledge Legal and Technical Risks' before initiating interactive login."),
							indicator: "orange"
						});
						return;
					}
					sentra_ats.show_crawler_login_dialog(frm.doc.name);
				});
				if (!frm.doc.risk_acknowledged) {
					login_btn.addClass("btn-secondary disabled");
				} else {
					login_btn.addClass("btn-primary");
				}
			}
		}
	}
});
