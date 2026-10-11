# Server Script (type: API, method: hris_mark_notifications_read, allow_guest: 0)
# POST body: names (opsional; daftar JSON atau dipisah koma). Tanpa names: semua milik pemanggil.
# Hanya notifikasi milik pemanggil. Hasil: daftar notifikasi terbaru (sama dengan hris_get_notifications).
raw = frappe.form_dict.get("names")
names = []
if raw:
    if isinstance(raw, list):
        names = raw
    elif str(raw).strip().startswith("["):
        names = frappe.parse_json(raw)
    else:
        names = [n.strip() for n in str(raw).split(",") if n.strip()]
filters = {"for_user": frappe.session.user, "read": 0}
if raw:
    filters["name"] = ["in", names or ["-"]]
for n in frappe.get_all("Notification Log", filters=filters, pluck="name", limit_page_length=1000):
    frappe.db.set_value("Notification Log", n, "read", 1)

cat_map = {"Leave Application": "Approval", "Salary Slip": "Payroll", "Attendance Request": "Presensi", "Travel Request": "Approval", "Overtime Request": "Approval", "Employee Document": "Pengumuman", "Employee Performance Feedback": "Appraisal", "Appraisal": "Appraisal"}
is_hr = frappe.session.user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": frappe.session.user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager", "System Manager"]]},
                   limit_page_length=1)
) > 0
rows = frappe.get_all(
    "Notification Log",
    filters={"for_user": frappe.session.user},
    fields=["name", "subject", "email_content", "creation", "read", "document_type", "document_name"],
    order_by="creation desc",
    limit_page_length=50,
)
result = []
for r in rows:
    subj = r.subject or ""
    low = subj.lower()
    tone = "info"
    if "approved" in low:
        tone = "ok"
    elif "rejected" in low:
        tone = "bad"
    elif "waiting" in low:
        tone = "warn"
    file_url = None
    file_name = None
    if r.document_type == "Employee Document" and r.document_name:
        # file terbaru yang terlampir, hanya bila pemanggil berhak membaca dokumennya
        doc_emp = frappe.db.get_value("Employee Document", r.document_name, "employee")
        can_read = is_hr or (doc_emp and frappe.db.get_value("Employee", doc_emp, "user_id") == frappe.session.user)
        if can_read:
            f = frappe.get_all("File", filters={"attached_to_doctype": "Employee Document",
                                                 "attached_to_name": r.document_name},
                               fields=["file_url", "file_name"], order_by="creation desc", limit_page_length=1)
            if f:
                file_url = f[0].file_url
                file_name = f[0].file_name
    result.append(
        {
            "name": r.name,
            "subject": subj,
            "body": frappe.utils.strip_html(r.email_content) if r.email_content else "",
            "category": cat_map.get(r.document_type, "Pengumuman"),
            "tone": tone,
            "time": str(r.creation)[:19].replace(" ", "T"),
            "read": 1 if r.read else 0,
            "document_type": r.document_type,
            "document_name": r.document_name,
            "file_url": file_url,
            "file_name": file_name,
        }
    )
frappe.response["message"] = result
