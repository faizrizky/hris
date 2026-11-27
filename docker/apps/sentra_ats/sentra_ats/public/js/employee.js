frappe.ui.form.on("Employee", {
	setup(frm) {
		frm.set_query("custom_bank_account", () => ({ filters: { party_type: "Employee", party: frm.doc.name } }));
	},

	refresh(frm) {
		if (frm.is_new()) return;
		frm.add_custom_button(
			__("Bank Account"),
			() => frappe.new_doc("Bank Account", { party_type: "Employee", party: frm.doc.name, account_name: frm.doc.employee_name }),
			__("Create")
		);
	},
});
