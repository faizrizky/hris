# Server Script (type: API, method: hris_submit_wfh, allow_guest: 0)
# Ajukan jadwal WFH (doctype WFH Schedule, status Pending sampai diputuskan atasan).
# POST: from_date, to_date (YYYY-MM-DD), days (mis. "mon,wed,fri"), reason.
# Hasil: {"name","from_date","to_date","days":["mon",...],"reason","status":"pending"}
fd = frappe.form_dict
from_date = fd.get("from_date")
to_date = fd.get("to_date")
reason = (fd.get("reason") or "").strip()
valid = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
days = []
for d in (fd.get("days") or "").split(","):
    d = d.strip().lower()
    if d in valid and d not in days:
        days.append(d)
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name", "reports_to", "employee_name"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
if not from_date or not to_date:
    frappe.throw("from_date and to_date are required")
if frappe.utils.getdate(to_date) < frappe.utils.getdate(from_date):
    frappe.throw("The end date cannot be before the start date")
if frappe.utils.getdate(from_date) < frappe.utils.getdate(frappe.utils.nowdate()):
    frappe.throw("WFH cannot start in the past")
if frappe.utils.date_diff(to_date, from_date) > 92:
    frappe.throw("A WFH request can span at most 3 months")
if not days:
    frappe.throw("Choose at least one WFH day")
if not reason:
    frappe.throw("A reason is required")
for o in frappe.get_all("WFH Schedule", filters={"employee": me[0].name, "status": ["in", ["Pending", "Approved"]],
                                                 "enabled": 1, "from_date": ["<=", to_date],
                                                 "to_date": [">=", from_date]},
                        fields=days, limit_page_length=20):
    for d in days:
        if o.get(d):
            frappe.throw("You already have a WFH schedule that overlaps these dates")
vals = {"doctype": "WFH Schedule", "employee": me[0].name, "from_date": from_date, "to_date": to_date,
        "reason": reason, "enabled": 1, "status": "Pending", "requested_by_employee": 1}
for d in days:
    vals[d] = 1
doc = frappe.get_doc(vals)
doc.insert(ignore_permissions=True)
boss = frappe.db.get_value("Employee", me[0].reports_to, "user_id") if me[0].reports_to else None
if boss:
    frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": boss,
                    "subject": "WFH request from " + str(me[0].employee_name) + " is waiting for your approval",
                    "email_content": from_date + " to " + to_date + ": " + ", ".join(days),
                    "document_type": "WFH Schedule", "document_name": doc.name}).insert(ignore_permissions=True)
    share = frappe.get_doc({"doctype": "DocShare", "user": boss, "share_doctype": "WFH Schedule",
                            "share_name": doc.name, "read": 1})
    share.flags.ignore_share_permission = True
    share.insert(ignore_permissions=True)
frappe.response["message"] = {"name": doc.name, "from_date": from_date, "to_date": to_date, "days": days,
                              "reason": reason, "status": "pending"}
