frappe.listview_settings["HRIS Subscription"] = {
	add_fields: ["status", "valid_until", "sync_error"],

	get_indicator(doc) {
		if (doc.sync_error) return [__("Sync error"), "red", "sync_error,is,set"];
		if (doc.status !== "Active") return [__("Inactive"), "red", "status,=,Inactive"];
		const soon = frappe.datetime.add_days(frappe.datetime.get_today(), 30);
		if (doc.valid_until && doc.valid_until <= soon) return [__("Expiring"), "orange", "status,=,Active"];
		return [__("Active"), "green", "status,=,Active"];
	},

	onload(listview) {
		frappe.xcall("hris_ats.subscription.summary").then((s) => {
			listview.page.add_inner_message(
				__("{0} active, {1} inactive, {2} expiring within 30 days, {3} with sync errors", [s.active, s.inactive, s.expiring, s.errors])
			);
		});
	},
};
