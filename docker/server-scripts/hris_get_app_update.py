# Server Script (type: API, method: hris_get_app_update, allow_guest: 1)
# Versi aplikasi terbaru untuk pemeriksa pembaruan di aplikasi (dipanggil sebelum login, jadi tanpa sesi).
# Hasil: {"version_code","version_name","apk_url","size","notes","mandatory"}; apk_url relatif (diawali /) atau mutlak. Tanpa APK -> version_code 0.
code = frappe.db.get_single_value("App Update", "version_code") or 0
name = frappe.db.get_single_value("App Update", "version_name") or ""
apk = frappe.db.get_single_value("App Update", "apk_url") or frappe.db.get_single_value("App Update", "apk") or ""
notes = frappe.db.get_single_value("App Update", "release_notes") or ""
mandatory = frappe.db.get_single_value("App Update", "mandatory")
size = frappe.db.get_single_value("App Update", "apk_size") or 0
if apk and not size:
    f = frappe.get_all("File", filters={"file_url": apk}, fields=["file_size"], limit_page_length=1)
    size = f[0].file_size if f else 0
frappe.response["message"] = {
    "version_code": int(code), "version_name": name,
    "apk_url": apk,  # bisa relatif (/files/..); aplikasi menggabungkannya dengan alamat servernya sendiri
    "size": int(size or 0), "notes": notes, "mandatory": 1 if mandatory is None or mandatory else 0,
}
