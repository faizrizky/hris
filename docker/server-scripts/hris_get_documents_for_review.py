# Server Script (type: API, method: hris_get_documents_for_review, allow_guest: 0)
# Daftar Employee Document untuk verifikasi HR. Hanya HR User / HR Manager (selain itu 403).
# ?status=Pending (default) | Verified | Rejected | all. Terbaru dulu, maks 200.
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
if not is_hr:
    frappe.throw("Only HR can review documents", frappe.PermissionError)
status = frappe.form_dict.get("status") or "Pending"
if status not in ("Pending", "Verified", "Rejected", "all"):
    frappe.throw("status must be Pending, Verified, Rejected or all")
filters = {}
if status != "all":
    filters["status"] = status
result = []
for q in frappe.get_all("Employee Document", filters=filters,
                        fields=["name", "employee", "employee_name", "document_name", "category", "expires_on",
                                "status", "verified_by", "rejection_reason", "creation"],
                        order_by="creation desc", limit_page_length=200):
    emp = frappe.db.get_value("Employee", q.employee, ["designation", "department"], as_dict=True) or {}
    f = frappe.get_all("File", filters={"attached_to_doctype": "Employee Document", "attached_to_name": q.name},
                       fields=["file_url", "file_name", "file_size"], order_by="creation desc", limit_page_length=1)
    fu = f[0] if f else None
    result.append({
        "name": q.name,
        "employee": q.employee,
        "employee_name": q.employee_name,
        "designation": emp.get("designation"),
        "department": emp.get("department"),
        "document_name": q.document_name,
        "category": q.category,
        "ext": (fu.file_name.split(".")[-1].upper() if fu and "." in fu.file_name else None),
        "size_bytes": fu.file_size if fu else None,
        "uploaded_on": str(q.creation)[:10],
        "expires_on": str(q.expires_on) if q.expires_on else None,
        "status": q.status,
        "file_url": fu.file_url if fu else None,
        "file_name": fu.file_name if fu else None,
        "verified_by": q.verified_by,
        "rejection_reason": q.rejection_reason,
    })
frappe.response["message"] = result
