# Server Script (type: API, method: hris_register_push_token, allow_guest: 0)
# POST: token (Expo push token), platform (ios|android), device_name. Upsert per token untuk user sesi.
fd = frappe.form_dict
token = (fd.get("token") or "").strip()
if not (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")) or len(token) > 200:
    frappe.throw("token must be a valid Expo push token")
vals = {"user": frappe.session.user, "platform": (fd.get("platform") or "")[:20],
        "device_name": (fd.get("device_name") or "")[:140], "last_seen": frappe.utils.now_datetime()}
if frappe.db.exists("Push Token", token):
    frappe.db.set_value("Push Token", token, vals)
else:
    vals["doctype"] = "Push Token"
    vals["token"] = token
    frappe.get_doc(vals).insert(ignore_permissions=True)
frappe.response["message"] = {"token": token, "registered": True}
