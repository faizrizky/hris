# Server Script (type: API, method: hris_get_hr_service, allow_guest: 0)
# GET ?kind=shift_request|leave_encashment|grievance|training|onboarding. Hanya data milik pemanggil.
# Hasil: {"items":[{id,title,detail,from,to,status}], "fields":[{key,type,required,choices:[{value,label}]}], "notice"}
# @include: _lib/paket_lib.py
kind = frappe.form_dict.get("kind")
need = {"shift_request": "absensi", "leave_encashment": "cuti"}.get(kind)
if need and need not in pk_info()["fitur"]:
    frappe.throw("This feature is not included in your subscription plan", frappe.PermissionError)
rows = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                      fields=["name", "company", "department", "reports_to", "shift_request_approver"], limit_page_length=1)
if not rows:
    frappe.throw("This account is not linked to an active employee")
me = rows[0]
today = frappe.utils.nowdate()
items = []
fields = []
notice = None

if kind == "shift_request":
    for r in frappe.get_all("Shift Request", filters={"employee": me.name},
                            fields=["name", "shift_type", "from_date", "to_date", "status", "docstatus"],
                            order_by="creation desc", limit_page_length=50):
        status = "pending" if r.docstatus == 0 else ("cancelled" if r.docstatus == 2 else r.status.lower())
        items.append({"id": r.name, "title": r.shift_type, "detail": None, "from": str(r.from_date),
                      "to": str(r.to_date) if r.to_date else None, "status": status})
    choices = []
    for s in frappe.get_all("Shift Type", pluck="name", order_by="name asc", limit_page_length=100):
        choices.append({"value": s, "label": s})
    if not me.shift_request_approver and not frappe.get_all(
            "Department Approver", filters={"parent": me.department or "-", "parentfield": "shift_request_approver"},
            limit_page_length=1):
        notice = "no_approver"
    else:
        fields = [{"key": "shift_type", "type": "choice", "required": 1, "choices": choices},
                  {"key": "from_date", "type": "date", "required": 1},
                  {"key": "to_date", "type": "date", "required": 0}]
elif kind == "leave_encashment":
    for r in frappe.get_all("Leave Encashment", filters={"employee": me.name},
                            fields=["name", "leave_type", "encashment_days", "encashment_date", "docstatus"],
                            order_by="creation desc", limit_page_length=50):
        status = {0: "pending", 1: "approved", 2: "cancelled"}[r.docstatus]
        items.append({"id": r.name, "title": r.leave_type, "detail": str(frappe.utils.flt(r.encashment_days)),
                      "from": str(r.encashment_date) if r.encashment_date else None, "to": None, "status": status})
    encashable = frappe.get_all("Leave Type", filters={"allow_encashment": 1}, pluck="name", limit_page_length=100)
    choices = []
    for a in frappe.get_all("Leave Allocation", filters={"employee": me.name, "docstatus": 1, "from_date": ["<=", today],
                                                         "to_date": [">=", today], "leave_type": ["in", encashable or ["-"]]},
                            fields=["leave_type"], limit_page_length=50):
        choices.append({"value": a.leave_type, "label": a.leave_type})
    if choices:
        fields = [{"key": "leave_type", "type": "choice", "required": 1, "choices": choices},
                  {"key": "days", "type": "number", "required": 1}]
    else:
        notice = "nothing_encashable"
elif kind == "grievance":
    for r in frappe.get_all("Employee Grievance", filters={"raised_by": me.name, "docstatus": ["<", 2]},
                            fields=["name", "subject", "grievance_type", "status", "date", "resolution_detail"],
                            order_by="creation desc", limit_page_length=50):
        items.append({"id": r.name, "title": r.subject, "detail": r.resolution_detail or r.grievance_type,
                      "from": str(r.date), "to": None, "status": r.status.lower()})
    types = []
    for g in frappe.get_all("Grievance Type", pluck="name", order_by="name asc", limit_page_length=100):
        types.append({"value": g, "label": g})
    against = [{"value": "company", "label": me.company}]
    if me.department:
        against.append({"value": "department", "label": me.department})
    if me.reports_to:
        against.append({"value": "supervisor", "label": frappe.db.get_value("Employee", me.reports_to, "employee_name")})
    if types:
        fields = [{"key": "grievance_type", "type": "choice", "required": 1, "choices": types},
                  {"key": "against", "type": "choice", "required": 1, "choices": against},
                  {"key": "subject", "type": "text", "required": 1},
                  {"key": "description", "type": "multiline", "required": 1}]
    else:
        notice = "no_grievance_type"
elif kind == "training":
    pending = []
    now = str(frappe.utils.now_datetime())
    for row in frappe.get_all("Training Event Employee", filters={"employee": me.name, "parenttype": "Training Event"},
                              fields=["parent", "attendance"], order_by="creation desc",
                              parent_doctype="Training Event", limit_page_length=50):
        ev = frappe.db.get_value("Training Event", row.parent,
                                 ["event_name", "location", "start_time", "end_time", "docstatus"], as_dict=True)
        if not ev or ev.docstatus != 1:
            continue
        if frappe.db.exists("Training Feedback", {"employee": me.name, "training_event": row.parent, "docstatus": ["<", 2]}):
            status = "feedback_sent"
        elif row.attendance == "Absent":
            status = "absent"
        elif str(ev.start_time) > now:
            status = "upcoming"
        else:
            status = "awaiting_feedback"
            pending.append({"value": row.parent, "label": ev.event_name})
        items.append({"id": row.parent, "title": ev.event_name, "detail": ev.location, "from": str(ev.start_time)[:10],
                      "to": str(ev.end_time)[:10] if ev.end_time else None, "status": status})
    if pending:
        fields = [{"key": "training_event", "type": "choice", "required": 1, "choices": pending},
                  {"key": "feedback", "type": "multiline", "required": 1}]
elif kind == "onboarding":
    ob = frappe.get_all("Employee Onboarding", filters={"employee": me.name, "docstatus": ["<", 2]}, pluck="name",
                        order_by="creation desc", limit_page_length=1)
    if ob:
        for a in frappe.get_all("Employee Boarding Activity",
                                filters={"parent": ob[0], "parenttype": "Employee Onboarding"},
                                fields=["name", "activity_name", "task", "description"], order_by="idx asc",
                                parent_doctype="Employee Onboarding", limit_page_length=200):
            done = a.task and frappe.db.get_value("Task", a.task, "status") == "Completed"
            items.append({"id": a.name, "title": a.activity_name,
                          "detail": frappe.utils.strip_html(a.description) if a.description else None,
                          "from": None, "to": None, "status": "done" if done else "todo"})
else:
    frappe.throw("Unknown kind")

frappe.response["message"] = {"items": items, "fields": fields, "notice": notice}
