# Server Script (type: API, method: hris_logout_sessions, allow_guest: 0)
# POST: ids = JSON daftar id sesi (SHA-256 sid, dari hris_get_active_sessions). Mengeluarkan sesi-sesi itu SAJA
# (satu perangkat); sesi saat ini tidak pernah boleh dikeluarkan lewat sini. Maksimal 8 id per panggilan.
# Hasil: sisa sesi, bentuk sama dengan hris_get_active_sessions.
ids = json.loads(frappe.form_dict.get("ids") or "[]")
if not ids or len(ids) > 8:
    frappe.throw("ids must contain 1 to 8 session ids")
user_doc = frappe.get_doc("User", frappe.session.user)
boleh = {}
for s in user_doc.active_sessions:
    if not s.is_current:
        boleh[s.name] = True
for sid_hash in ids:
    if sid_hash not in boleh:
        frappe.throw("Session not found or is the current session")
for sid_hash in ids:
    try:
        frappe.call("frappe.core.doctype.user.user.clear_session", sid_hash=sid_hash)
    except Exception:
        frappe.throw("Too many sign-out requests in the last hour. Please try again later.")
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
