// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

frappe.pages["bgc-crawl-test"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Crawl Test"),
		single_column: true,
	});
	new BgcCrawlTest(page);
};

const BGC_CT_CSS = `
.bgc-ct { max-width: 1100px; padding: 24px 32px 48px; }
.bgc-ct .ct-card { background: var(--card-bg, #fff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
.bgc-ct .ct-grid { display: grid; gap: 14px 16px; grid-template-columns: 200px 1fr; align-items: start; }
.bgc-ct .ct-grid-3 { display: grid; gap: 14px 16px; grid-template-columns: repeat(3, 1fr); margin-top: 14px; }
.bgc-ct label.ct-label { display: block; font-size: 12px; color: var(--text-muted, #718096); margin-bottom: 4px; }
.bgc-ct .ct-hint { font-size: 11px; color: var(--text-muted, #718096); margin-top: 4px; }
.bgc-ct .ct-check { display: flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 13px; }
.bgc-ct .ct-check input { width: 16px; height: 16px; margin: 0; }
.bgc-ct .ct-accounts { margin-top: 10px; font-size: 12px; color: var(--text-muted, #718096); }
.bgc-ct .ct-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
.bgc-ct .ct-chip { font-size: 12px; background: var(--control-bg, #f4f5f6); border-radius: 999px; padding: 3px 12px; }
.bgc-ct .ct-profile { display: grid; grid-template-columns: 150px 1fr; gap: 6px 14px; font-size: 13px; }
.bgc-ct .ct-profile dt { color: var(--text-muted, #718096); font-weight: 500; margin: 0; }
.bgc-ct .ct-profile dd { margin: 0; word-break: break-word; }
.bgc-ct .ct-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--border-color, #e2e8f0); margin-bottom: 12px; }
.bgc-ct .ct-tab { border: 0; background: none; padding: 8px 14px; font-weight: 600; font-size: 13px; color: var(--text-muted, #718096); border-bottom: 2px solid transparent; cursor: pointer; }
.bgc-ct .ct-tab.active { color: var(--text-color, #1a202c); border-bottom-color: var(--primary, #2b6cb0); }
.bgc-ct .ct-list { max-height: 62vh; overflow-y: auto; border: 1px solid var(--border-color, #e2e8f0); border-radius: 10px; }
.bgc-ct .ct-row { padding: 12px 16px; border-bottom: 1px solid var(--border-color, #edf2f7); }
.bgc-ct .ct-row:last-child { border-bottom: 0; }
.bgc-ct .ct-row-head { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--text-muted, #718096); margin-bottom: 4px; }
.bgc-ct .ct-row-text { font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.bgc-ct .ct-empty { padding: 28px; text-align: center; color: var(--text-muted, #718096); }
.bgc-ct details summary { cursor: pointer; font-weight: 600; font-size: 13px; }
.bgc-ct .ct-log { font-size: 12px; margin-top: 8px; max-height: 200px; overflow: auto; }
@media (max-width: 720px) { .bgc-ct .ct-grid, .bgc-ct .ct-grid-3, .bgc-ct .ct-profile { grid-template-columns: 1fr; } }
`;

class BgcCrawlTest {
	constructor(page) {
		this.page = page;
		this.timer = null;
		this.tab = "posts";
		this.esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
		this.safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
		if (!document.getElementById("bgc-ct-css")) {
			$(`<style id="bgc-ct-css">${BGC_CT_CSS}</style>`).appendTo("head");
		}
		this.render_form();
		frappe
			.xcall("sentra_ats.bgc.crawl_test.get_crawl_test_defaults")
			.then((d) => {
				this.apply_defaults(d);
				return frappe.xcall("sentra_ats.bgc.crawl_test.get_latest_crawl_test");
			})
			.then((s) => s && this.resume(s));
	}

	// A reloaded page shows the last test again (and keeps following it while it is still running)
	resume(s) {
		this.test_id = s.test_id;
		const a = s.args || {};
		if (a.platform) this.$(".ct-platform").val(a.platform);
		if (a.username) this.$(".ct-username").val(a.username);
		if (a.max_posts != null) this.$(".ct-max-posts").val(a.max_posts);
		if (a.max_comments != null) this.$(".ct-max-comments").val(a.max_comments);
		if (a.lookback_months != null) this.$(".ct-lookback").val(a.lookback_months);
		this.$(".ct-consent").prop("checked", true);
		this.state = s;
		this.render();
		if (["Queued", "Running", "Cancelling"].includes(s.status)) {
			clearInterval(this.timer);
			this.timer = setInterval(() => this.poll(), 2000);
		}
	}

	render_form() {
		this.page.main.html(`
			<div class="bgc-ct">
				<p class="text-muted" style="max-width: 760px;">${__("Runs the real crawler on one social account (profile, posts and the candidate's own comments) without creating a Background Check. Nothing is saved.")}</p>
				<div class="ct-card">
					<div class="ct-grid">
						<div>
							<label class="ct-label">${__("Platform")}</label>
							<select class="form-control ct-platform"></select>
						</div>
						<div>
							<label class="ct-label">${__("Username or profile link")}</label>
							<input type="text" class="form-control ct-username" placeholder="username" autocomplete="off">
							<div class="ct-hint">${__("Use the handle from the profile link, not the display name.")}</div>
						</div>
					</div>
					<div class="ct-grid-3">
						<div><label class="ct-label">${__("Max posts")}</label><input type="number" min="1" class="form-control ct-max-posts"></div>
						<div><label class="ct-label">${__("Max comments")}</label><input type="number" min="0" class="form-control ct-max-comments"></div>
						<div><label class="ct-label">${__("Lookback months")}</label><input type="number" min="0" class="form-control ct-lookback"><div class="ct-hint">${__("0 = no limit")}</div></div>
					</div>
					<label class="ct-check"><input type="checkbox" class="ct-consent"> ${__("I own this account or have the owner's permission")}</label>
					<div class="ct-accounts"></div>
				</div>
				<div class="ct-out"></div>
			</div>`);
		this.$ = (sel) => this.page.main.find(sel);
		this.page.set_primary_action(__("Run crawl test"), () => this.start(), "play");
		this.$(".ct-username").on("keydown", (e) => {
			if (e.key === "Enter") this.start();
		});
	}

	apply_defaults(d) {
		this.$(".ct-platform").html(d.platforms.map((p) => `<option value="${this.esc(p)}">${this.esc(p)}</option>`).join(""));
		this.$(".ct-max-posts").val(d.max_posts);
		this.$(".ct-max-comments").val(d.max_comments);
		this.$(".ct-lookback").val(d.lookback_months);
		const rows = (d.crawler_accounts || []).map(
			(a) => `${this.esc(a.platform)}: ${this.esc(a.status)}${a.enabled && a.risk_acknowledged ? "" : " (" + __("disabled or risk not acknowledged") + ")"}`
		);
		this.$(".ct-accounts").html(
			`${__("Crawler accounts")}: ${rows.join(" · ") || __("none")}.${d.use_login_session ? "" : " " + __("Login-session crawling is switched off in Background Check Settings.")}`
		);
	}

	start() {
		const username = (this.$(".ct-username").val() || "").trim();
		if (!username) {
			frappe.show_alert({ message: __("Please select platform and enter username"), indicator: "orange" });
			return;
		}
		clearInterval(this.timer);
		this._scrolled = false;
		this.tab = "posts";
		this.$(".ct-out").html(`<div class="text-muted">${__("Starting...")}</div>`);
		frappe
			.xcall("sentra_ats.bgc.crawl_test.start_crawl_test", {
				platform: this.$(".ct-platform").val(),
				username: username,
				consent_acknowledged: this.$(".ct-consent").is(":checked") ? 1 : 0,
				max_posts: this.$(".ct-max-posts").val(),
				max_comments: this.$(".ct-max-comments").val(),
				lookback_months: this.$(".ct-lookback").val(),
			})
			.then((r) => {
				this.test_id = r.test_id;
				if (r.resumed) {
					frappe.show_alert({ message: __("A crawl test is already running; showing it."), indicator: "blue" });
				}
				this.timer = setInterval(() => this.poll(), 2000);
				this.poll();
			})
			.catch(() => this.$(".ct-out").empty());
	}

	poll() {
		frappe.xcall("sentra_ats.bgc.crawl_test.poll_crawl_test", { test_id: this.test_id }).then((s) => {
			this.state = s;
			this.render();
			if (["Done", "Failed", "Expired", "Cancelled"].includes(s.status)) clearInterval(this.timer);
		});
	}

	rows(items, empty) {
		if (!items || !items.length) return `<div class="ct-empty">${empty}</div>`;
		const sorted = [...items].sort((a, b) => String(b.published_on || "").localeCompare(String(a.published_on || "")));
		return `<div class="ct-list">${sorted
			.map((r) => {
				const link = this.safeUrl(r.url)
					? `<a href="${this.esc(r.url)}" target="_blank" rel="noopener noreferrer">${__("Open")} ↗</a>`
					: "";
				return `<div class="ct-row">
					<div class="ct-row-head"><span>${this.esc(r.published_on || "-")} ${this.toneBadge(__("Word lists"), r.tone)} ${this.toneBadge(__("Model"), r.model_tone)}</span>${link}</div>
					<div class="ct-row-text">${this.esc(r.snippet)}</div>
				</div>`;
			})
			.join("")}</div>`;
	}

	// Matrix cell of one item: profanity x tone (see bgc/analysis/posts.py)
	toneBadge(source, t) {
		if (!t) return "";
		const color = { Safe: "green", Slang: "blue", Warning: "orange", Unclear: "gray", "Red flag": "red" }[t.cell] || "gray";
		const terms = (t.terms || []).length ? ` · ${this.esc(t.terms.join(", "))}` : "";
		return `<span class="indicator-pill ${color}" title="${this.esc(source)}">${this.esc(source)}: ${this.esc(__(t.cell))} (${this.esc(__(t.tone))})${terms}</span>`;
	}

	toneSummary(summary) {
		if (!summary) return "";
		const line = (label, part) => {
			if (!part) return "";
			const counts = ["Safe", "Warning", "Slang", "Unclear", "Red flag"]
				.filter((c) => part.counts[c])
				.map((c) => `${this.esc(__(c))}: <b>${part.counts[c]}</b>`)
				.join(" · ");
			return `<div class="mb-1"><b>${this.esc(label)}</b> — ${counts || "-"} · ${__("Toxicity score")}: <b>${this.esc(part.toxicity_score)}</b></div>`;
		};
		return `<div class="ct-card"><div class="mb-2"><b>${__("Toxicity matrix")}</b></div>
			${line(__("Word lists"), summary.words)}
			${summary.model ? line(__("Model"), summary.model) : `<div class="text-muted">${__("Sentiment model is not configured; tone comes from the word lists only.")}</div>`}
		</div>`;
	}

	render() {
		const s = this.state || {};
		const res = s.result || {};
		const color = { Done: "green", Failed: "red", Running: "blue", Queued: "orange", Cancelling: "orange", Cancelled: "gray", Expired: "gray" }[s.status] || "gray";
		const active = ["Queued", "Running", "Cancelling"].includes(s.status);
		const posts = res.posts || [];
		const comments = res.comments || [];
		const finished = ["Done", "Failed", "Cancelled"].includes(s.status);
		const log = (s.log || [])
			.map((l) => `<div><span class="text-muted">${l.t}s</span> ${this.esc(l.message)}</div>`)
			.join("");
		const val = (v) => (v == null || v === "" ? "-" : this.esc(v));
		const link = this.safeUrl(res.profile_url)
			? `<a href="${this.esc(res.profile_url)}" target="_blank" rel="noopener noreferrer">${this.esc(res.profile_url)}</a>`
			: "-";
		const notes = [res.error, res.comment_limitation]
			.filter(Boolean)
			.map((n) => `<div class="alert alert-warning py-2 mb-3">${this.esc(n)}</div>`)
			.join("");

		this.$(".ct-out").html(`
			<div class="ct-card">
				<div class="ct-chips">
					<span class="indicator-pill ${color}">${this.esc(__(s.status))}</span>
					<span class="ct-chip">${__("Duration")}: ${s.seconds != null ? s.seconds + " s" : "-"}</span>
					<span class="ct-chip">${__("Mode")}: ${val(res.mode_used)}</span>
					<span class="ct-chip">${__("Crawler account")}: ${val(res.crawler_account)}</span>
					${active ? `<button type="button" class="btn btn-xs btn-default ct-cancel" ${s.status === "Cancelling" ? "disabled" : ""}>${__("Cancel")}</button>` : ""}
				</div>
				${s.status === "Queued" ? `<div class="text-muted mb-2">${__("Waiting for a free browser worker. Another crawl may be running; this will start right after it.")}</div>` : ""}
				${notes}
				${s.result ? `<dl class="ct-profile">
					<dt>${__("Name")}</dt><dd>${val(res.display_name)}</dd>
					<dt>${__("Bio")}</dt><dd>${val(res.bio)}</dd>
					<dt>${__("Followers")}</dt><dd>${val(res.followers_count)}</dd>
					<dt>${__("Following")}</dt><dd>${val(res.following_count)}</dd>
					<dt>${__("Posts")}</dt><dd>${val(res.posts_count)}</dd>
					<dt>${__("Profile")}</dt><dd>${link}</dd>
				</dl>` : ""}
			</div>
			${s.result ? `
			${this.toneSummary(res.tone_summary)}
			<div class="ct-card">
				<div class="ct-tabs">
					<button type="button" class="ct-tab ${this.tab === "posts" ? "active" : ""}" data-tab="posts">${__("Posts")} (${posts.length})</button>
					<button type="button" class="ct-tab ${this.tab === "comments" ? "active" : ""}" data-tab="comments">${__("Comments written by the candidate")} (${comments.length})</button>
				</div>
				${this.tab === "posts" ? this.rows(posts, __("No posts found")) : this.rows(comments, __("No comments written by the candidate were found."))}
			</div>` : ""}
			<details class="ct-card" ${finished ? "" : "open"}><summary>${__("Log")}</summary><div class="ct-log">${log || "-"}</div></details>
		`);
		this.$(".ct-cancel").on("click", () => {
			frappe.xcall("sentra_ats.bgc.crawl_test.cancel_crawl_test", { test_id: this.test_id }).then(() => this.poll());
		});
		this.$(".ct-tab").on("click", (e) => {
			this.tab = $(e.currentTarget).data("tab");
			this.render();
		});
		if (finished && !this._scrolled) {
			this._scrolled = true;
			this.$(".ct-out")[0].scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}
}
