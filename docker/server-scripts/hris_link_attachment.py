# Server Script (type: DocType Event, doctype: File, event: After Insert)
# Unggahan karyawan ke dokumen pengajuan (foto profil, selfie wajah) ditautkan ke field lampirannya. Frappe tidak selalu
# mengisi field itu bila pengunggah tidak punya hak tulis penuh pada dokumen.
targets = {"Profile Change Request": ["photo"], "Face Enrollment": ["selfie"]}
if doc.attached_to_doctype in targets and doc.attached_to_name and doc.attached_to_field in targets[doc.attached_to_doctype]:
    frappe.db.set_value(doc.attached_to_doctype, doc.attached_to_name, doc.attached_to_field, doc.file_url)
