// Adds "Generate THR" to the Additional Salary list; keeps whatever HRMS already put in the list settings.
const additional_salary_settings = (frappe.listview_settings["Additional Salary"] = frappe.listview_settings["Additional Salary"] || {});
const additional_salary_previous_onload = additional_salary_settings.onload;

additional_salary_settings.onload = function (listview) {
	if (additional_salary_previous_onload) additional_salary_previous_onload.call(this, listview);
	if (!frappe.model.can_create("Additional Salary")) return;

	listview.page.add_inner_button(__("Generate THR"), () => {
		const dialog = new frappe.ui.Dialog({
			title: __("Generate THR"),
			fields: [
				{ fieldname: "payment_date", label: __("Payment Date"), fieldtype: "Date", reqd: 1 },
				{ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company" },
				{ fieldname: "preview", fieldtype: "HTML" },
			],
			primary_action_label: __("Preview THR"),
			primary_action(values) {
				const create = dialog.created_preview ? 1 : 0;
				frappe.call({
					method: "hris_ats.hr_compliance.generate_thr",
					args: { payment_date: values.payment_date, company: values.company, create },
					freeze: true,
					callback(r) {
						const rows = r.message || [];
						const due = rows.filter((row) => row.amount && !row.skipped);
						dialog.fields_dict.preview.$wrapper.html(
							due.length || rows.length
								? `<table class="table table-bordered"><thead><tr><th>${__("Employee")}</th><th>${__("Months")}</th><th>${__("Monthly Wage")}</th><th>${__("Amount")}</th><th>${__("Note")}</th></tr></thead><tbody>${rows
										.map((row) => `<tr><td>${frappe.utils.escape_html(row.employee_name || row.employee)}</td><td>${row.months}</td><td>${format_currency(row.monthly_wage)}</td><td>${format_currency(row.amount)}</td><td>${frappe.utils.escape_html(row.skipped || "")}</td></tr>`)
										.join("")}</tbody></table>`
								: `<p class="text-muted">${__("Nothing is due on this date.")}</p>`
						);
						if (create) {
							dialog.hide();
							frappe.show_alert({ message: __("THR entries created as draft Additional Salary."), indicator: "green" });
							listview.refresh();
						} else if (due.length) {
							dialog.created_preview = true;
							dialog.get_primary_btn().text(__("Create THR entries"));
						}
					},
				});
			},
		});
		dialog.show();
	});
};
