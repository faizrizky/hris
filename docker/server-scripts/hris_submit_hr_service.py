# Server Script (type: API, method: hris_submit_hr_service, allow_guest: 0)
# POST kind=shift_request|leave_encashment|grievance|training beserta field-nya. Selalu atas nama karyawan pemanggil;
# validasi bisnis (bentrok shift, saldo cuti, peserta pelatihan) dijalankan controller Frappe HR.
# @include: _lib/paket_lib.py
fd = frappe.form_dict
kind = fd.get("kind")
need = {"shift_request": "absensi", "leave_encashment": "cuti"}.get(kind)
if need and need not in pk_info()["fitur"]:
    frappe.throw("This feature is not included in your subscription plan", frappe.PermissionError)
rows = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                      fields=["name", "company", "department", "reports_to", "shift_request_approver"], limit_page_length=1)
if not rows:
    frappe.throw("This account is not linked to an active employee")
me = rows[0]
today = frappe.utils.nowdate()
submit = False

if kind == "shift_request":
    if not fd.get("shift_type") or not fd.get("from_date"):
        frappe.throw("shift_type and from_date are required")
    approver = me.shift_request_approver
    if not approver:
        found = frappe.get_all("Department Approver",
                               filters={"parent": me.department or "-", "parentfield": "shift_request_approver"},
                               fields=["approver"], order_by="idx asc", parent_doctype="Department", limit_page_length=1)
        approver = found[0].approver if found else None
    if not approver:
        frappe.throw("No shift request approver is set for you. Please contact HR")
    data = {"doctype": "Shift Request", "employee": me.name, "company": me.company, "shift_type": fd.get("shift_type"),
            "from_date": fd.get("from_date"), "to_date": fd.get("to_date") or None, "status": "Draft",
            "approver": approver}
elif kind == "leave_encashment":
    days = frappe.utils.flt(fd.get("days"))
    leave_type = fd.get("leave_type")
    if not leave_type or days <= 0:
        frappe.throw("leave_type and a positive number of days are required")
    if frappe.db.exists("Leave Encashment", {"employee": me.name, "leave_type": leave_type, "docstatus": 0}):
        frappe.throw("A request for this leave type is still waiting for HR")
    period = frappe.get_all("Leave Period", filters={"company": me.company, "is_active": 1, "from_date": ["<=", today],
                                                     "to_date": [">=", today]}, pluck="name", limit_page_length=1)
    if not period:
        frappe.throw("There is no active leave period. Please contact HR")
    assignment = frappe.get_all("Salary Structure Assignment", filters={"employee": me.name, "docstatus": 1},
                                fields=["currency"], order_by="from_date desc", limit_page_length=1)
    currency = (assignment[0].currency if assignment else None) or frappe.db.get_value("Company", me.company,
                                                                                      "default_currency")
    data = {"doctype": "Leave Encashment", "employee": me.name, "company": me.company, "leave_period": period[0],
            "leave_type": leave_type, "encashment_date": today, "encashment_days": days, "currency": currency}
elif kind == "grievance":
    subject = (fd.get("subject") or "").strip()
    description = (fd.get("description") or "").strip()
    if not fd.get("grievance_type") or not subject or not description:
        frappe.throw("grievance_type, subject and description are required")
    target = {"company": ("Company", me.company), "department": ("Department", me.department),
              "supervisor": ("Employee", me.reports_to)}.get(fd.get("against"))
    if not target or not target[1]:
        frappe.throw("Choose who the grievance is about")
    data = {"doctype": "Employee Grievance", "raised_by": me.name, "date": today, "status": "Open", "subject": subject,
            "description": description, "grievance_type": fd.get("grievance_type"),
            "grievance_against_party": target[0], "grievance_against": target[1]}
elif kind == "training":
    event = fd.get("training_event")
    text = (fd.get("feedback") or "").strip()
    if not event or not text:
        frappe.throw("training_event and feedback are required")
    if frappe.db.exists("Training Feedback", {"employee": me.name, "training_event": event, "docstatus": ["<", 2]}):
        frappe.throw("Feedback for this training has already been sent")
    data = {"doctype": "Training Feedback", "employee": me.name, "training_event": event, "feedback": text}
    submit = True
else:
    frappe.throw("Unknown kind")

doc = frappe.get_doc(data)
doc.insert(ignore_permissions=True)
if submit:
    doc.flags.ignore_permissions = True
    doc.submit()
frappe.response["message"] = {"name": doc.name}
