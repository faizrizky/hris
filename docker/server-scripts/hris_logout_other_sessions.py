# Server Script (type: API, method: hris_logout_other_sessions, allow_guest: 0)
# Keluarkan semua sesi pemanggil KECUALI sesi saat ini (POST, tanpa body).
# Memanggil frappe.core.doctype.user.user.clear_session (batas bawaan 10 panggilan/jam).
# Hasil: sisa sesi, bentuk sama dengan hris_get_active_sessions.
# clear_session bawaan dipanggil sekali per sesi lain dan dibatasi 10 panggilan/jam (per alamat IP klien). Pesan yang jelas
# bila batas tercapai, supaya aplikasi tidak hanya menampilkan "Gagal memproses".
user_doc = frappe.get_doc("User", frappe.session.user)
lain = [x.name for x in user_doc.active_sessions if not x.is_current]
if len(lain) > 8:
    frappe.throw("Too many old sessions (" + str(len(lain)) + "). Ask HR/admin to clear old sessions, or try again later.")
for sid_hash in lain:
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
