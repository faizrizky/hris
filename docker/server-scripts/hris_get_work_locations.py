# Server Script (type: API, method: hris_get_work_locations, allow_guest: 0)
# GET: Shift Location (hrms) yang berlaku beserta radius, dan aturan geofence yang berlaku. Dipakai aplikasi untuk
# menampilkan jarak waktu nyata sebelum check-in. Dinas luar aktif tidak dibahas di sini (server yang memutuskan).
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
today = frappe.utils.getdate(frappe.utils.get_datetime_in_timezone(frappe.utils.get_system_timezone()))
names = frappe.get_all("Shift Assignment",
                       filters={"employee": me[0].name, "docstatus": 1, "status": "Active",
                                "shift_location": ["is", "set"], "start_date": ["<=", str(today)]},
                       or_filters=[["end_date", ">=", str(today)], ["end_date", "is", "not set"]],
                       pluck="shift_location", limit_page_length=20)
flt = {"name": ["in", names]} if names else {}
locs = []
for wl in frappe.get_all("Shift Location", filters=flt,
                         fields=["name", "location_name", "latitude", "longitude", "checkin_radius"],
                         limit_page_length=100):
    locs.append({"name": wl.name, "location_name": wl.location_name, "latitude": wl.latitude,
                 "longitude": wl.longitude, "radius_m": wl.checkin_radius or 100})
mode = frappe.db.get_single_value("Geofence Settings", "geofence_mode") or "Flag"
wfh_fields = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
today = frappe.utils.getdate(frappe.utils.get_datetime_in_timezone(frappe.utils.get_system_timezone()))
wd = today.weekday()
wfh_today = False
for w in frappe.get_all("WFH Schedule", filters={"employee": me[0].name, "enabled": 1,
                                                 "from_date": ["<=", str(today)], "to_date": [">=", str(today)]},
                        fields=wfh_fields, limit_page_length=20):
    if w.get(wfh_fields[wd]):
        wfh_today = True
acc = frappe.db.get_single_value("Geofence Settings", "max_accuracy_m") or 100
frappe.response["message"] = {"locations": locs, "geofence_mode": mode, "max_accuracy_m": acc, "wfh_today": wfh_today,
                            "require_location": 1 if frappe.db.get_single_value("Geofence Settings", "require_location") else 0}
