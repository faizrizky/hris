# Server Script (type: API, method: hris_logout_other_sessions, allow_guest: 0)
# Keluarkan semua sesi pemanggil KECUALI sesi saat ini (POST, tanpa body).
# Memanggil frappe.core.doctype.user.user.clear_session (batas bawaan 10 panggilan/jam).
# Hasil: sisa sesi, bentuk sama dengan hris_get_active_sessions.
user_doc = frappe.get_doc("User", frappe.session.user)
for s in user_doc.active_sessions:
    if not s.is_current:
        frappe.call("frappe.core.doctype.user.user.clear_session", sid_hash=s.name)
user_doc = frappe.get_doc("User", frappe.session.user)
result = []
for s in user_doc.active_sessions:
    result.append(
        {
            "id": s.name,
            "ip": s.ip_address,
            "last_updated": s.last_updated,
            "user_agent": s.user_agent,
            "current": bool(s.is_current),
        }
    )
frappe.response["message"] = result
