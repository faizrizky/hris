// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

window.hris_ats = window.hris_ats || {};

hris_ats.show_bulk_upload_dialog = function (job_opening) {
	const file_urls = [];
	const dialog = new frappe.ui.Dialog({
		title: __("Bulk Upload CVs"),
		fields: [
			{
				fieldtype: "HTML",
				fieldname: "intro",
				options: `<p class="text-muted">${__("Each readable CV becomes a Job Applicant for this job opening and is screened automatically. Scanned images, encrypted PDFs and CVs without an email address go to manual review.")}</p>`,
			},
			{ fieldtype: "Link", fieldname: "job_opening", label: __("Job Opening"), options: "Job Opening", reqd: 1, default: job_opening || "" },
			{ fieldtype: "Button", fieldname: "choose", label: __("Choose CV files (PDF or DOCX)") },
			{ fieldtype: "HTML", fieldname: "files" },
			{
				fieldtype: "Check",
				fieldname: "consent_confirmed",
				label: __("I confirm these candidates agreed to their data being processed for recruitment purposes."),
			},
		],
		primary_action_label: __("Start upload"),
		primary_action(values) {
			if (!file_urls.length) {
				frappe.msgprint(__("Choose at least one CV file."));
				return;
			}
			if (!values.consent_confirmed) {
				frappe.msgprint(__("Confirm that these candidates agreed to their data being processed for recruitment before uploading."));
				return;
			}
			frappe
				.xcall("hris_ats.scoring.bulk_upload.start_bulk_upload", {
					job_opening: values.job_opening,
					file_urls: JSON.stringify(file_urls),
					consent_confirmed: 1,
				})
				.then((r) => {
					dialog.hide();
					frappe.set_route("Form", "Resume Upload Batch", r.batch);
				});
		},
	});
	const render_files = () => {
		const esc = frappe.utils.escape_html;
		dialog.fields_dict.files.$wrapper.html(
			file_urls.length
				? `<div class="small mb-2">${__("{0} files ready", [file_urls.length])}</div><ul class="small">${file_urls.map((u) => `<li>${esc(decodeURIComponent(u.split("/").pop()))}</li>`).join("")}</ul>`
				: `<div class="small text-muted">${__("No files chosen yet.")}</div>`
		);
	};
	dialog.fields_dict.choose.$input.on("click", () => {
		new frappe.ui.FileUploader({
			allow_multiple: true,
			make_attachments_public: false,
			restrictions: { allowed_file_types: [".pdf", ".docx"] },
			on_success(file_doc) {
				if (file_doc && file_doc.file_url && !file_urls.includes(file_doc.file_url)) {
					file_urls.push(file_doc.file_url);
					render_files();
				}
			},
		});
	});
	render_files();
	dialog.show();
};
