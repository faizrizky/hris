# Server Script (type: API, method: hris_get_langganan, allow_guest: 1)
# Paket langganan company di site ini, dibaca aplikasi setelah kode company dikenali registry (sebelum login).
# Hasil: {"paket","berlaku_sampai","aktif","fitur":[...],"company","logo"}
# @include: _lib/paket_lib.py
info = pk_info()
co = frappe.db.get_single_value("Global Defaults", "default_company")
info["company"] = co
info["logo"] = frappe.db.get_value("Company", co, "company_logo") if co else None
frappe.response["message"] = info
