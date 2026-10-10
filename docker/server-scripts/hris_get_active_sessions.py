# Server Script (type: API, method: hris_get_active_sessions, allow_guest: 0)
# Sesi aktif milik pemanggil. id = SHA-256 dari sid (aman; sid mentah tidak pernah dikembalikan).
# Hasil: [{"id","ip","last_updated","user_agent","current"}]
# Catatan: pemanggil dengan token API (bukan sid) tidak punya sesi saat ini, jadi current selalu false.
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
