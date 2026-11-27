// Every form section is laid out as two columns without holes: fields flow into a two-column grid
// (css/form_columns.css) in the order they sit side by side, and a field that would be left alone in its row takes the
// whole row. Sections holding only full-width fields (tables, editors) keep Frappe's own columns. Fields are only
// re-flowed, never moved in the DOM. Hook: jQuery "form-refresh"; a MutationObserver repeats the check when depends_on
// shows or hides fields.
frappe.provide("sentra_ats.form_columns");

Object.assign(sentra_ats.form_columns, {
	WIDE: new Set(["Table", "Table MultiSelect", "Text Editor", "Text", "Long Text", "Code", "HTML Editor",
		"Markdown Editor", "HTML", "Geolocation", "Heading", "Signature"]),

	// `columns` is a list of columns, each a list of booleans (is the field full width?). Returns null when the section
	// should be left alone, else the fields in grid order as {column, row, span}.
	plan(columns) {
		const items = columns.flatMap((fields, column) =>
			fields.map((wide, row) => ({ column, row, wide, span: wide, order: row * columns.length + column }))
		);
		if (!items.length || items.every((item) => item.wide)) return null;
		items.sort((a, b) => a.order - b.order);
		let alone = null; // a half-width field still waiting for a neighbour
		for (const item of items) {
			if (item.wide) {
				if (alone) alone.span = true;
				alone = null;
			} else {
				alone = alone ? null : item;
			}
		}
		if (alone) alone.span = true;
		return items;
	},

	tidy(wrapper) {
		wrapper.querySelectorAll(".form-section > .section-body").forEach((body) => {
			const columns = [...body.querySelectorAll(":scope > .form-column")].map((column) => [
				...column.querySelectorAll(":scope > form > .frappe-control:not(.hide-control)"),
			]);
			const plan = this.plan(columns.map((fields) => fields.map((el) => this.WIDE.has(el.dataset.fieldtype))));
			body.classList.toggle("hris-flow", Boolean(plan));
			columns.flat().forEach((el) => {
				if (!plan) el.classList.remove("hris-span");
			});
			(plan || []).forEach(({ column, row, span, order }) => {
				const el = columns[column][row];
				el.style.order = order + 1; // 0 stays for column headings
				el.classList.toggle("hris-span", span);
			});
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

$(document).on("form-refresh", (_event, frm) => setTimeout(() => sentra_ats.form_columns.watch(frm)));
