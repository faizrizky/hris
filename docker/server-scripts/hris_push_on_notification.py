# Server Script (type: DocType Event, doctype: Notification Log, event: After Insert)
# Kirim push Expo ke semua token milik for_user (satu permintaan per token). Mode dry run (Push Settings.dry_run=1): payload hanya
# dicatat ke Error Log (judul "Push (dry run)"). Token yang dibalas DeviceNotRegistered dihapus.
# @include: _lib/notif_lib.py
tokens = frappe.get_all("Push Token", filters={"user": doc.for_user}, fields=["name"], limit_page_length=20)
if tokens:
    body = nt_teks(doc.email_content)
    messages = []
    for t in tokens:
        messages.append({"to": t.name, "title": nt_teks(doc.subject or doc.title) or "Notification", "body": body,
                         "data": {"notification": doc.name}, "sound": "default"})
    if frappe.db.get_single_value("Push Settings", "dry_run"):
        frappe.log_error(title="Push (dry run)", message=json.dumps(messages))
    else:
        # Satu permintaan per token: satu batch yang berisi token dari beberapa proyek Expo (mis. build lama dan baru)
        # ditolak seluruhnya (400 PUSH_TOO_MANY_EXPERIENCE_IDS).
        for m in messages:
            try:
                res = frappe.make_post_request("https://exp.host/--/api/v2/push/send", json=[m], timeout=8)
                tk = (res.get("data") or [{}])[0]
                if tk.get("status") == "error":
                    err = (tk.get("details") or {}).get("error")
                    if err == "DeviceNotRegistered":
                        frappe.delete_doc("Push Token", m["to"], ignore_permissions=True, force=True)
                    else:
                        frappe.log_error(title="Push error", message=json.dumps(tk))
            except Exception as e:
                frappe.log_error(title="Push send failed", message=str(e))
