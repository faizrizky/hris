# Server Script (type: API, method: hris_register_device, allow_guest: 0)
# POST: device_id, device_name, platform, tutorial_seen (1 = tutorial aplikasi sudah dilihat di perangkat ini).
# Mendaftarkan/membaca status perangkat pemanggil.
# Hasil: {"status": "Approved|Pending|Rejected|Unknown", "tutorial_seen": 0|1, "devices": [{"name","device_name","platform","status","last_seen"}]}
# @include: _lib/device_lib.py
fd = frappe.form_dict
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name", "employee_name"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
st = dv_resolve(me[0].name, me[0].employee_name, fd.get("device_id"), fd.get("device_name"), fd.get("platform"))
mine = frappe.get_all("Registered Device", filters={"employee": me[0].name,
                      "device_id": (fd.get("device_id") or "").strip()[:140] or "-"},
                      fields=["name", "tutorial_seen"], limit_page_length=1)
seen = 1 if mine and mine[0].tutorial_seen else 0
if mine and not seen and str(fd.get("tutorial_seen") or "") == "1":
    frappe.db.set_value("Registered Device", mine[0].name, "tutorial_seen", 1, update_modified=False)
    seen = 1
devs = frappe.get_all("Registered Device", filters={"employee": me[0].name},
                      fields=["name", "device_id", "device_name", "platform", "status", "last_seen"],
                      order_by="creation asc", limit_page_length=20)
frappe.response["message"] = {"status": st, "tutorial_seen": seen, "devices": [
    {"name": d.name, "device_name": d.device_name, "platform": d.platform, "status": d.status,
     "last_seen": str(d.last_seen)[:19] if d.last_seen else None,
     "current": 1 if d.device_id == (fd.get("device_id") or "").strip() else 0} for d in devs]}
