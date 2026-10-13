# Server Script (type: DocType Event, doctype: Leave Application, event: Before Save)
# Aturan jenis cuti khusus menurut jenis kelamin karyawan:
#   Maternity Leave hanya untuk karyawan perempuan; Spouse Childbirth Leave (istri melahirkan/keguguran) untuk laki-laki.
# Batas hari per pengajuan dijaga hrms lewat max_continuous_days_allowed pada Leave Type.
gender = frappe.db.get_value("Employee", doc.employee, "gender")
if doc.leave_type == "Maternity Leave" and gender != "Female":
    frappe.throw("Maternity leave is only for female employees")
if doc.leave_type == "Spouse Childbirth Leave" and gender != "Male":
    frappe.throw("Spouse childbirth leave is only for male employees")
