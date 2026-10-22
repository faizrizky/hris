# Server Script (type: API, method: hris_cek_company, allow_guest: 1) - HANYA di site registry (registry.py).
# POST/GET kode=... Kode company -> site klien yang dihubungi aplikasi. Dibatasi 10 permintaan/menit per IP.
# Hasil: {"kode","nama_company","site","base_url","channel"}; kode tidak dikenal / nonaktif -> 404.
kode = str(frappe.form_dict.get("kode") or "").strip()[:40]
t = frappe.db.get_value("HRIS Tenant", {"kode": kode, "aktif": 1},
                        ["kode", "nama_company", "site", "base_url", "channel"], as_dict=True) if kode else None
if not t:
    frappe.throw("Company code is not registered", frappe.DoesNotExistError)
frappe.response["message"] = t
