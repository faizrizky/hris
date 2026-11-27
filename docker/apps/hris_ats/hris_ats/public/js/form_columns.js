// Tidy form sections into two columns: a section whose fields sit in a single column (leaving the rest of the page
// empty), or in three or more columns that are mostly empty, flows its fields into a two-column grid
// (css/form_columns.css). Fields are only re-flowed, never moved in the DOM. Hook: jQuery "form-refresh"; a
// MutationObserver repeats the check when depends_on shows or hides fields.
frappe.provide("hris_ats.form_columns");

Object.assign(hris_ats.form_columns, {
	// Should a section be re-flowed? `counts` is the number of visible fields in each of its columns.
	needs_flow(counts) {
		const total = counts.reduce((sum, n) => sum + n, 0);
		const filled = counts.filter(Boolean).length;
		if (!total) return false;
		if (filled === 1) return true;
		return counts.length >= 3 && (filled < counts.length || total < counts.length * 2);
	},

	tidy(wrapper) {
		wrapper.querySelectorAll(".form-section > .section-body").forEach((body) => {
			const counts = [...body.querySelectorAll(":scope > .form-column")].map(
				(column) => column.querySelectorAll(":scope > form > .frappe-control:not(.hide-control)").length
			);
			body.classList.toggle("hris-flow", this.needs_flow(counts));
		});
	},

	watch(frm) {
		const wrapper = frm.layout?.wrapper?.[0];
		if (!wrapper) return;
		this.tidy(wrapper);
		if (wrapper.hris_observer) return;
		let queued = false;
		wrapper.hris_observer = new MutationObserver(() => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => {
				queued = false;
				this.tidy(wrapper);
			});
		});
		wrapper.hris_observer.observe(wrapper, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
	},
});

$(document).on("form-refresh", (_event, frm) => setTimeout(() => hris_ats.form_columns.watch(frm)));
