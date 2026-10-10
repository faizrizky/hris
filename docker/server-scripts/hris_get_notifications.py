# Server Script (type: API, method: hris_get_notifications, allow_guest: 0)
# Kotak masuk notifikasi pemanggil (Notification Log, for_user = session user), terbaru dulu, maks 50.
# category diturunkan dari document_type: Leave Application -> Approval, Salary Slip -> Payroll,
# Attendance Request -> Presensi. tone: ok | warn | info | bad. time = waktu server (Asia/Jakarta, tanpa offset).
cat_map = {"Leave Application": "Approval", "Salary Slip": "Payroll", "Attendance Request": "Presensi"}
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
    body = frappe.utils.strip_html(r.email_content) if r.email_content else ""
    result.append(
        {
            "name": r.name,
            "subject": subj,
            "body": body,
            "category": cat_map.get(r.document_type, "Pengumuman"),
            "tone": tone,
            "time": str(r.creation)[:19].replace(" ", "T"),
            "read": 1 if r.read else 0,
            "document_type": r.document_type,
            "document_name": r.document_name,
        }
    )
frappe.response["message"] = result
