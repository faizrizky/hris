// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.provide("hris_ats");

hris_ats.show_crawler_login_dialog = function (account_name, on_complete) {
	frappe.call({
		method: "hris_ats.bgc.crawler_session.start_login_session",
		args: { account_name: account_name },
		freeze: true,
		freeze_message: __("Starting remote browser on server..."),
		callback: function (r) {
			if (!r.message || !r.message.session_id) return;
			let session_id = r.message.session_id;
			let platform = r.message.platform;
			let login_url = r.message.login_url;

			let is_closing = false;
			let last_interaction_time = Date.now();
			let last_frame_seq = 0;
			let poll_timer = null;
			let poll_busy = false;
			let type_buffer = "";
			let type_timer = null;

			function schedule_next_poll(delay) {
				if (is_closing) return;
				if (poll_timer) clearTimeout(poll_timer);
				poll_timer = setTimeout(do_poll, delay);
			}

			function get_adaptive_delay() {
				let idle_ms = Date.now() - last_interaction_time;
				return idle_ms < 3000 ? 200 : 1000;
			}

			function send_input_immediately(ev) {
				last_interaction_time = Date.now();
				frappe.call({
					method: "hris_ats.bgc.crawler_session.send_crawler_input",
					args: {
						session_id: session_id,
						input_event: ev
					},
					no_spinner: true
				});
				schedule_next_poll(150);
			}

			function flush_type_buffer() {
				if (type_timer) {
					clearTimeout(type_timer);
					type_timer = null;
				}
				if (type_buffer.length > 0) {
					let text_to_send = type_buffer;
					type_buffer = "";
					send_input_immediately({ type: "type", text: text_to_send });
				}
			}

			let d = new frappe.ui.Dialog({
				title: __("Interactive Login: {0} ({1})", [platform, account_name]),
				size: "extra-large",
				fields: [
					{
						fieldtype: "HTML",
						fieldname: "browser_view"
					}
				],
				primary_action_label: __("Complete Login"),
				primary_action: function () {
					flush_type_buffer();
					d.get_primary_btn().prop("disabled", true).text(__("Verifying & saving session..."));
					frappe.call({
						method: "hris_ats.bgc.crawler_session.complete_login_session",
						args: { session_id: session_id },
						callback: function (res) {
							if (res.message && res.message.status === "Connected") {
								if (poll_timer) clearTimeout(poll_timer);
								is_closing = true;
								d.hide();
								let domains_str = (res.message.cookie_domains_found || []).join(", ") || __("none");
								frappe.msgprint({
									title: __("Login Successful"),
									indicator: "green",
									message: `
										<p><strong>${__("Crawler account connected successfully.")}</strong></p>
										<p><small class="text-muted">${__("Session expires on")}: ${frappe.datetime.str_to_user(res.message.session_expires_on)}</small></p>
										<p><small class="text-muted">${__("Discovered cookie domains")}: <code>${frappe.utils.escape_html(domains_str)}</code></small></p>
									`
								});
								if (on_complete) on_complete(res.message);
							} else {
								d.get_primary_btn().prop("disabled", false).text(__("Complete Login"));
							}
						},
						error: function () {
							d.get_primary_btn().prop("disabled", false).text(__("Complete Login"));
						}
					});
				},
				secondary_action_label: __("Manual Cookie Import"),
				secondary_action: function () {
					flush_type_buffer();
					show_manual_cookie_import_dialog(account_name, function (res) {
						if (poll_timer) clearTimeout(poll_timer);
						is_closing = true;
						d.hide();
						if (on_complete) on_complete(res);
					});
				}
			});

			let $wrapper = d.fields_dict.browser_view.$wrapper;
			$wrapper.html(`
				<div class="crawler-browser-modal p-2">
					<div class="d-flex align-items-center justify-content-between mb-2 p-2 bg-light border rounded">
						<div class="d-flex align-items-center gap-2">
							<span class="badge badge-info" style="font-size: 0.85rem;">${frappe.utils.escape_html(platform)}</span>
							<span id="crawler-status-badge" class="badge badge-warning">${__("Connecting...")}</span>
							<span id="crawler-page-url" class="small text-muted text-monospace" style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${frappe.utils.escape_html(login_url)}</span>
						</div>
						<div class="d-flex align-items-center gap-2">
							<span id="crawler-timer" class="small font-weight-bold text-danger">⏱️ 10:00</span>
						</div>
					</div>

					<div class="text-center bg-dark p-1 rounded" style="position: relative; min-height: 500px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
						<div id="crawler-spinner" class="text-white text-center">
							<div class="spinner-border spinner-border-sm mb-2" role="status"></div>
							<div class="small">${__("Loading remote browser session...")}</div>
						</div>
						<img id="crawler-viewport-img"
							tabindex="0"
							style="display: none; width: 100%; max-width: 1024px; aspect-ratio: 1024/768; object-fit: contain; cursor: crosshair; outline: none; border-radius: 4px;"
							alt="Remote Browser Viewport" />
					</div>

					<div class="d-flex align-items-center justify-content-between mt-2 px-1">
						<div class="small text-muted">
							🔒 ${__("Human interactive login. Click and type directly into the browser view. Credentials are never logged by the system.")}
						</div>
						<div class="small text-muted font-italic">
							${__("Fixed viewport: 1024x768")}
						</div>
					</div>
				</div>
			`);

			let img = $wrapper.find("#crawler-viewport-img")[0];
			let spinner = $wrapper.find("#crawler-spinner");
			let statusBadge = $wrapper.find("#crawler-status-badge");
			let urlSpan = $wrapper.find("#crawler-page-url");
			let timerSpan = $wrapper.find("#crawler-timer");

			// Mouse events forwarding
			$(img).on("click", function (e) {
				flush_type_buffer();
				let rect = img.getBoundingClientRect();
				let scaleX = 1024 / rect.width;
				let scaleY = 768 / rect.height;
				let x = Math.round((e.clientX - rect.left) * scaleX);
				let y = Math.round((e.clientY - rect.top) * scaleY);
				send_input_immediately({ type: "click", x: x, y: y, button: "left" });
				img.focus();
			});

			$(img).on("wheel", function (e) {
				e.preventDefault();
				flush_type_buffer();
				let orig = e.originalEvent || e;
				send_input_immediately({ type: "scroll", deltaX: orig.deltaX || 0, deltaY: orig.deltaY || 0 });
			});

			// Keyboard events forwarding with keystroke coalescing
			$(img).on("keydown", function (e) {
				e.preventDefault();
				let key = e.key;
				if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
					type_buffer += key;
					if (type_timer) clearTimeout(type_timer);
					if (type_buffer.length >= 10) {
						flush_type_buffer();
					} else {
						type_timer = setTimeout(flush_type_buffer, 40);
					}
				} else {
					flush_type_buffer();
					send_input_immediately({ type: "keydown", key: key });
				}
			});

			// Cleanup on dialog dismiss
			d.$wrapper.on("hidden.bs.modal", function () {
				flush_type_buffer();
				if (poll_timer) clearTimeout(poll_timer);
				if (!is_closing) {
					frappe.call({
						method: "hris_ats.bgc.crawler_session.close_login_session",
						args: { session_id: session_id }
					});
				}
			});

			// Adaptive Polling loop
			function do_poll() {
				if (is_closing || poll_busy) return;
				poll_busy = true;

				frappe.call({
					method: "hris_ats.bgc.crawler_session.poll_login_session",
					args: {
						session_id: session_id,
						last_frame_seq: last_frame_seq
					},
					no_spinner: true,
					always: function () {
						poll_busy = false;
						schedule_next_poll(get_adaptive_delay());
					},
					callback: function (poll_res) {
						if (!poll_res.message) return;
						let m = poll_res.message;

						if (m.status === "closed" || m.status === "error") {
							if (poll_timer) clearTimeout(poll_timer);
							statusBadge.removeClass("badge-warning badge-success").addClass("badge-danger").text(m.status);
							return;
						}

						if (m.status === "active" || m.status === "completed") {
							statusBadge.removeClass("badge-warning badge-danger").addClass("badge-success").text(__("Active"));
						}

						if (m.frame_seq !== undefined && m.frame_seq !== null) {
							last_frame_seq = m.frame_seq;
						}

						if (m.frame_b64) {
							spinner.hide();
							$(img).show().attr("src", "data:image/jpeg;base64," + m.frame_b64);
						}

						if (m.url) {
							urlSpan.text(m.url).attr("title", m.url);
						}

						if (m.remaining !== undefined) {
							let mins = Math.floor(m.remaining / 60);
							let secs = m.remaining % 60;
							timerSpan.text(`⏱️ ${mins}:${secs < 10 ? "0" : ""}${secs}`);
						}
					}
				});
			}

			// Start initial poll immediately
			schedule_next_poll(50);

			d.show();
		}
	});
};

function show_manual_cookie_import_dialog(account_name, on_success) {
	let import_dialog = new frappe.ui.Dialog({
		title: __("Manual Cookie / Storage State Import: {0}", [account_name]),
		fields: [
			{
				fieldtype: "HTML",
				fieldname: "help_text",
				options: `
					<div class="small text-muted mb-3">
						${__("Paste the exported JSON storage state or array of cookies from your browser session. Only cookies matching the platform session domains will be retained and securely encrypted.")}
					</div>
				`
			},
			{
				label: __("Storage State / Cookies (JSON)"),
				fieldname: "raw_json",
				fieldtype: "Code",
				options: "JSON",
				reqd: 1
			}
		],
		primary_action_label: __("Import and Save"),
		primary_action: function (vals) {
			if (!vals.raw_json) return;
			frappe.call({
				method: "hris_ats.bgc.crawler_session.import_manual_storage_state",
				args: {
					account_name: account_name,
					raw_json: vals.raw_json
				},
				freeze: true,
				freeze_message: __("Encrypting and saving session..."),
				callback: function (r) {
					if (r.message && r.message.status === "Connected") {
						import_dialog.hide();
						let domains_str = (r.message.cookie_domains_found || []).join(", ") || __("none");
						frappe.msgprint({
							title: __("Session Saved"),
							indicator: "green",
							message: `
								<p><strong>${__("Manual session imported successfully.")}</strong></p>
								<p><small class="text-muted">${__("Session expires on")}: ${frappe.datetime.str_to_user(r.message.session_expires_on)}</small></p>
								<p><small class="text-muted">${__("Discovered cookie domains")}: <code>${frappe.utils.escape_html(domains_str)}</code></small></p>
							`
						});
						if (on_success) on_success(r.message);
					}
				}
			});
		}
	});
	import_dialog.show();
}
