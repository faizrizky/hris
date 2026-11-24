frappe.ui.form.on("HRIS Subscription", {
	onload(frm) {
		// Suggestion list of the sites on this server; the ones already registered are marked.
		frappe.xcall("hris_ats.subscription.list_sites", { current: frm.doc.site || null }).then((sites) => {
			frm.fields_dict.site.set_data(sites || []);
		});
	},

	refresh(frm) {
		if (frm.is_new()) return;
		frm.add_custom_button(__("Sync Now"), () => {
			frappe.call({
				method: "hris_ats.subscription.sync_now",
				args: { subscription: frm.doc.name },
				freeze: true,
				callback: () => frm.reload_doc(),
			});
		});
		if (frm.doc.sync_error) {
			frm.dashboard.set_headline(__("The last synchronization failed. See Sync Error below."), "red");
		}
	},
});
