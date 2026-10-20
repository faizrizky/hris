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

class BgcCrawlTest {
	constructor(page) {
		this.page = page;
		this.timer = null;
		this.esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
		this.safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
		this.render_form();
		frappe.xcall("hris_ats.bgc.crawl_test.get_crawl_test_defaults").then((d) => this.apply_defaults(d));
	}

	render_form() {
		this.page.main.html(`
			<div class="bgc-ct" style="max-width: 980px;">
				<p class="text-muted">${__("Runs the real crawler on one social account (profile, posts and the candidate's own comments) without creating a Background Check. Nothing is saved.")}</p>
				<div class="bgc-ct-form"></div>
				<div class="bgc-ct-accounts small text-muted mb-3"></div>
				<div class="bgc-ct-out"></div>
			</div>`);
		const f = (this.form = new frappe.ui.FieldGroup({
			body: this.page.main.find(".bgc-ct-form"),
			fields: [
				{ fieldname: "platform", label: __("Platform"), fieldtype: "Select", reqd: 1 },
				{
					fieldname: "username",
					label: __("Username or profile link"),
					fieldtype: "Data",
					reqd: 1,
					description: __("Use the handle from the profile link, not the display name."),
				},
				{ fieldtype: "Column Break" },
				{ fieldname: "max_posts", label: __("Max posts"), fieldtype: "Int" },
				{ fieldname: "max_comments", label: __("Max comments"), fieldtype: "Int" },
				{
					fieldname: "lookback_months",
					label: __("Lookback months"),
					fieldtype: "Int",
					description: __("0 = no limit"),
				},
				{ fieldtype: "Section Break" },
				{
					fieldname: "consent_acknowledged",
					label: __("I own this account or have the owner's permission"),
					fieldtype: "Check",
				},
			],
		}));
		f.make();
		this.page.set_primary_action(__("Run crawl test"), () => this.start(), "play");
	}

	apply_defaults(d) {
		this.form.set_df_property("platform", "options", d.platforms.join("\n"));
		this.form.set_value("platform", d.platforms[0] || "");
		this.form.set_value("max_posts", d.max_posts);
		this.form.set_value("max_comments", d.max_comments);
		this.form.set_value("lookback_months", d.lookback_months);
		const rows = (d.crawler_accounts || []).map(
			(a) => `${this.esc(a.platform)}: ${this.esc(a.status)}${a.enabled && a.risk_acknowledged ? "" : " (" + __("disabled or risk not acknowledged") + ")"}`
		);
		this.page.main.find(".bgc-ct-accounts").html(
			`${__("Crawler accounts")}: ${rows.join(" · ") || __("none")}.${d.use_login_session ? "" : " " + __("Login-session crawling is switched off in Background Check Settings.")}`
		);
	}

	start() {
		const v = this.form.get_values();
		if (!v) return;
		clearInterval(this.timer);
		this._scrolled = false;
		this.page.main.find(".bgc-ct-out").html(`<div class="text-muted">${__("Starting...")}</div>`);
		frappe
			.xcall("hris_ats.bgc.crawl_test.start_crawl_test", {
				platform: v.platform,
				username: v.username,
				consent_acknowledged: v.consent_acknowledged ? 1 : 0,
				max_posts: v.max_posts,
				max_comments: v.max_comments,
				lookback_months: v.lookback_months,
			})
			.then((r) => {
				this.test_id = r.test_id;
				this.timer = setInterval(() => this.poll(), 2000);
				this.poll();
			});
	}

	poll() {
		frappe.xcall("hris_ats.bgc.crawl_test.poll_crawl_test", { test_id: this.test_id }).then((s) => {
			this.render(s);
			if (["Done", "Failed", "Expired"].includes(s.status)) clearInterval(this.timer);
		});
	}

	table(rows, label) {
		if (!rows || !rows.length) {
			return `<div class="text-muted mb-3">${__("None found")}</div>`;
		}
		const sorted = [...rows].sort((a, b) => String(b.published_on || "").localeCompare(String(a.published_on || "")));
		const body = sorted
			.map((r) => {
				const link = this.safeUrl(r.url)
					? `<a href="${this.esc(r.url)}" target="_blank" rel="noopener noreferrer">${__("Open")} ↗</a>`
					: "";
				return `<tr><td style="white-space:nowrap">${this.esc(r.published_on || "-")}</td><td>${this.esc(r.snippet)}</td><td>${link}</td></tr>`;
			})
			.join("");
		return `<table class="table table-sm table-bordered mb-3"><thead><tr><th>${__("Date")}</th><th>${label}</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
	}

	render(s) {
		const color = { Done: "green", Failed: "red", Running: "blue", Queued: "gray", Expired: "gray" }[s.status] || "gray";
		const res = s.result || {};
		const log = (s.log || [])
			.map((l) => `<div class="small"><span class="text-muted">${l.t}s</span> ${this.esc(l.message)}</div>`)
			.join("");
		const profile = [
			[__("Name"), this.esc(res.display_name || "-")],
			[__("Bio"), this.esc(res.bio || "-")],
			[__("Followers / Following / Posts"), `${this.esc(res.followers_count ?? "-")} / ${this.esc(res.following_count ?? "-")} / ${this.esc(res.posts_count ?? "-")}`],
			[__("Profile"), this.safeUrl(res.profile_url) ? `<a href="${this.esc(res.profile_url)}" target="_blank" rel="noopener noreferrer">${this.esc(res.profile_url)}</a>` : "-"],
		]
			.map(([k, v]) => `<tr><th style="width:240px">${k}</th><td>${v}</td></tr>`)
			.join("");
		const run = [
			[__("Status"), `<span class="indicator-pill ${color}">${this.esc(__(s.status))}</span>`],
			[__("Duration"), s.seconds != null ? s.seconds + " s" : "-"],
			[__("Mode"), this.esc(res.mode_used || "-")],
			[__("Crawler account"), this.esc(res.crawler_account || "-")],
		]
			.map(([k, v]) => `<span class="mr-4"><span class="text-muted">${k}:</span> ${v}</span>`)
			.join("");
		const notes = [res.error, res.comment_limitation].filter(Boolean).map((n) => `<div class="alert alert-warning py-2 mb-2">${this.esc(n)}</div>`).join("");
		const posts = res.posts || [];
		const comments = res.comments || [];
		const finished = ["Done", "Failed"].includes(s.status);
		this.page.main.find(".bgc-ct-out").html(`
			<div class="mb-3">${run}</div>
			${notes}
			${s.result ? `
			<h6>${__("Profile")}</h6>
			<table class="table table-sm table-bordered mb-3"><tbody>${profile}</tbody></table>
			<h6>${__("Posts")} (${posts.length})</h6>${this.table(posts, __("Post"))}
			<h6>${__("Comments written by the candidate")} (${comments.length})</h6>${this.table(comments, __("Comment"))}` : ""}
			<details class="mb-3" ${finished ? "" : "open"}><summary class="font-weight-bold">${__("Log")}</summary>
				<div class="border rounded p-2 mt-2" style="max-height:200px; overflow:auto">${log || "-"}</div></details>
		`);
		if (finished && !this._scrolled) {
			this._scrolled = true;
			this.page.main.find(".bgc-ct-out")[0].scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}
}
