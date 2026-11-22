# Override Klien B: salinan skrip utama dengan satu perbedaan (catatan rilis diberi awalan nama klien).
code = frappe.db.get_single_value("App Update", "version_code") or 0
name = frappe.db.get_single_value("App Update", "version_name") or ""
apk = frappe.db.get_single_value("App Update", "apk_url") or frappe.db.get_single_value("App Update", "apk") or ""
notes = "[Klien B] " + (frappe.db.get_single_value("App Update", "release_notes") or "")
mandatory = frappe.db.get_single_value("App Update", "mandatory")
size = frappe.db.get_single_value("App Update", "apk_size") or 0
if apk and not size:
    f = frappe.get_all("File", filters={"file_url": apk}, fields=["file_size"], limit_page_length=1)
    size = f[0].file_size if f else 0
frappe.response["message"] = {
    "version_code": int(code), "version_name": name,
    "apk_url": apk,
    "size": int(size or 0), "notes": notes, "mandatory": 1 if mandatory is None or mandatory else 0,
}
