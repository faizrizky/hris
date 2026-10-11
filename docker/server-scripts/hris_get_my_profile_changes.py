# Server Script (type: API, method: hris_get_my_profile_changes, allow_guest: 0)
# Request perubahan data pribadi milik pemanggil, terbaru dulu (maks 50).
result = []
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name"], limit_page_length=1)
if me:
    for q in frappe.get_all("Profile Change Request", filters={"employee": me[0].name},
                            fields=["name", "status", "reason", "hr_note", "changes", "creation", "decided_on"],
                            order_by="creation desc", limit_page_length=50):
        result.append({"name": q.name, "status": q.status, "reason": q.reason, "hr_note": q.hr_note,
                       "changes": json.loads(q.changes) if q.changes else [],
                       "created_on": str(q.creation)[:19].replace(" ", "T"),
                       "decided_on": str(q.decided_on)[:19].replace(" ", "T") if q.decided_on else None})
frappe.response["message"] = result
