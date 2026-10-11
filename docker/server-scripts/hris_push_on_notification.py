# Server Script (type: DocType Event, doctype: Notification Log, event: After Insert)
# Kirim push Expo ke semua token milik for_user. Mode dry run (Push Settings.dry_run=1): payload hanya
# dicatat ke Error Log (judul "Push (dry run)"). Token yang dibalas DeviceNotRegistered dihapus.
tokens = frappe.get_all("Push Token", filters={"user": doc.for_user}, fields=["name"], limit_page_length=20)
if tokens:
    body = frappe.utils.strip_html(doc.email_content) if doc.email_content else ""
    messages = []
    for t in tokens:
        messages.append({"to": t.name, "title": doc.subject or doc.title or "Notification", "body": body,
                         "data": {"notification": doc.name}, "sound": "default"})
    if frappe.db.get_single_value("Push Settings", "dry_run"):
        frappe.log_error(title="Push (dry run)", message=json.dumps(messages))
    else:
        try:
            res = frappe.make_post_request("https://exp.host/--/api/v2/push/send", json=messages, timeout=8)
            tickets = res.get("data") or []
            for i in range(len(tickets)):
                tk = tickets[i]
                if tk.get("status") == "error":
                    err = (tk.get("details") or {}).get("error")
                    if err == "DeviceNotRegistered" and i < len(messages):
                        frappe.delete_doc("Push Token", messages[i]["to"], ignore_permissions=True, force=True)
                    else:
                        frappe.log_error(title="Push error", message=json.dumps(tk))
        except Exception as e:
            frappe.log_error(title="Push send failed", message=str(e))
