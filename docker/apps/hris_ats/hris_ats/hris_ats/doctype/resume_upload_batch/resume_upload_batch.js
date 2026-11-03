// Copyright (c) 2026, HRIS Team and contributors
// For license information, please see license.txt

const BATCH_POLL_MS = 3000;

frappe.ui.form.on("Resume Upload Batch", {
	refresh(frm) {
		frm.disable_save();
		const done = frm.doc.processed_files || 0;
		const total = frm.doc.total_files || 0;
		frm.dashboard.add_progress(__("Processed"), total ? (done / total) * 100 : 0, __("{0} of {1} files", [done, total]));
		if (frm._batch_poll) {
			clearInterval(frm._batch_poll);
			frm._batch_poll = null;
		}
		if (frm.doc.status !== "Done") {
			frm._batch_poll = setInterval(() => {
				if (!frm.page.wrapper.is(":visible")) return;
				frm.reload_doc();
			}, BATCH_POLL_MS);
		}
		frm.add_custom_button(__("Job Applicants"), () =>
			frappe.set_route("List", "Job Applicant", { job_title: frm.doc.job_opening })
		);
	},
});
