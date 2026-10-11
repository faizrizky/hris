# Server Script (type: API, method: hris_get_travel_requests, allow_guest: 0)
# Travel Request milik pemanggil, terbaru dulu, maks 50. status: pending (draft), approved (submitted),
# rejected (custom_rejected atau dibatalkan). ?scope=team: bawahan langsung (HR: semua) untuk persetujuan.
user = frappe.session.user
scope = frappe.form_dict.get("scope")
me = frappe.get_all("Employee", filters={"user_id": user, "status": "Active"}, fields=["name"], limit_page_length=1)
is_hr = user == "Administrator" or len(
    frappe.get_all(
        "Has Role",
        filters={"parent": user, "parenttype": "User", "role": ["in", ["HR User", "HR Manager"]]},
        limit_page_length=1,
    )
) > 0
filters = {}
ok = False
if scope == "team":
    if is_hr:
        ok = True
    elif me:
        team = [e.name for e in frappe.get_all("Employee", filters={"reports_to": me[0].name}, fields=["name"], limit_page_length=1000)]
        filters["employee"] = ["in", team or ["-"]]
        ok = True
elif me:
    filters["employee"] = me[0].name
    ok = True
result = []
if ok:
    rows = frappe.get_all(
        "Travel Request",
        filters=filters,
        fields=[
            "name", "employee", "employee_name", "description", "docstatus", "custom_destination",
            "custom_from_date", "custom_to_date", "custom_transport", "custom_timezone", "custom_rejected",
        ],
        order_by="creation desc",
        limit_page_length=50,
    )
    for q in rows:
        status = "pending"
        if q.custom_rejected or q.docstatus == 2:
            status = "rejected"
        elif q.docstatus == 1:
            status = "approved"
        total = 0
        costs = []
        for c in frappe.get_all(
            "Travel Request Costing",
            filters={"parent": q.name},
            fields=["expense_type", "total_amount", "comments"],
            order_by="idx asc",
            parent_doctype="Travel Request",
            limit_page_length=100,
        ):
            total = total + (c.total_amount or 0)
            costs.append({"category": c.expense_type, "description": c.comments, "amount": c.total_amount, "attachments": []})
        files = frappe.get_all("File", filters={"attached_to_doctype": "Travel Request", "attached_to_name": q.name},
                               fields=["file_name", "file_url", "attached_to_field"], order_by="creation asc",
                               limit_page_length=50)
        atts = []
        for f in files:
            fld = f.attached_to_field or ""
            if fld.startswith("cost_") and fld[5:].isdigit() and int(fld[5:]) < len(costs):
                costs[int(fld[5:])]["attachments"].append({"file_name": f.file_name, "file_url": f.file_url})
            else:
                atts.append({"file_name": f.file_name, "file_url": f.file_url})
        item = {
            "name": q.name,
            "destination": q.custom_destination,
            "from_date": str(q.custom_from_date) if q.custom_from_date else None,
            "to_date": str(q.custom_to_date) if q.custom_to_date else None,
            "transport": q.custom_transport,
            "purpose": q.description,
            "timezone": q.custom_timezone,
            "costs": costs,
            "total_cost": total,
            "status": status,
            "attachments": atts,
        }
        if scope == "team":
            item["employee"] = q.employee
            item["employee_name"] = q.employee_name
        result.append(item)
frappe.response["message"] = result
