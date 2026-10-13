# Server Script (type: API, method: hris_checkin, allow_guest: 0)
# Clock in/out dengan waktu ditentukan SERVER. POST: log_type = IN | OUT.
# Zona waktu = custom_timezone Travel Request approved yang mencakup hari ini; selain itu zona sistem.
# time disimpan sebagai jam dinding lokal zona itu (naive), zona yang dipakai disimpan di custom_timezone.
# Parameter OPSIONAL untuk check-in offline (tanpa parameter ini perilaku sama persis seperti sebelumnya):
#   offline (0/1), captured_ms (epoch UTC ms jam terpercaya saat ditekan), device_ms (epoch ms jam dinding HP),
#   trusted (0/1), anchor_age_s (detik sejak kontak server terakhir), client_id (unik per item antrean, idempotent).
# Aturan "bersih" (semua harus terpenuhi, nilai batas dari "Attendance Offline Settings"): offline=1, trusted=1,
#   captured_ms > 0 dan tidak > sekarang + future_tolerance_seconds, umur <= max_age_hours,
#   |device_ms - captured_ms| <= skew_tolerance_seconds, anchor_age <= max_anchor_age_hours,
#   jumlah check-in offline bulan ini < max_per_month, urutan tidak mundur. Bersih -> time = captured_ms (zona kerja).
#   Selain itu -> time = jam server saat diterima, review_status "Needs Review", alasan di flags.
# Parameter OPSIONAL geofence/GPS: lat, lng, accuracy_m, gps_ms (epoch ms cap waktu fix GPS), mocked (0/1).
#   Jarak dihitung ke "Work Location" aktif terdekat (pendekatan bidang datar, cukup untuk jarak ratusan meter).
#   Mode di "Geofence Settings": Off (hanya simpan), Flag (default: diterima, review "Needs Review"), Block (417).
#   Bersih bila jarak <= radius + min(akurasi, 50 m), akurasi <= max_accuracy_m, selisih waktu GPS <= toleransi,
#   dan tidak mocked. Dinas luar aktif membebaskan syarat radius (jarak tetap disimpan).
# Hasil: {"name","log_type","time","timezone","timezone_label","offline","review_status","flags":[...]}
fd = frappe.form_dict
log_type = (fd.get("log_type") or "").upper()
if log_type != "IN" and log_type != "OUT":
    frappe.throw("log_type must be IN or OUT")
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name", "employee_name", "reports_to"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
client_id = str(fd.get("client_id") or "").strip()
done = False
if client_id:
    prev = frappe.get_all("Employee Checkin", filters={"custom_client_id": client_id, "employee": me[0].name},
                          fields=["name", "log_type", "time", "custom_timezone", "custom_offline",
                                  "custom_review_status", "custom_flags"], limit_page_length=1)
    if prev:
        tzp = prev[0].custom_timezone or "Asia/Jakarta"
        fl = [x for x in (prev[0].custom_flags or "").split("; ") if x]
        frappe.response["message"] = {"name": prev[0].name, "log_type": prev[0].log_type,
                                      "time": str(prev[0].time)[:19], "timezone": tzp, "timezone_label": None,
                                      "offline": 1 if prev[0].custom_offline else 0,
                                      "review_status": prev[0].custom_review_status or "None", "flags": fl,
                                      "duplicate": 1}
        done = True
if not done:
    tz = frappe.utils.get_system_timezone()
    sys_today = frappe.utils.nowdate()
    trips = frappe.get_all("Travel Request", filters={"employee": me[0].name, "docstatus": 1, "custom_rejected": 0,
                                                       "custom_from_date": ["<=", sys_today],
                                                       "custom_to_date": [">=", sys_today]},
                           fields=["custom_timezone"], order_by="custom_from_date desc", limit_page_length=1)
    if trips and trips[0].custom_timezone:
        tz = trips[0].custom_timezone
    aware = str(frappe.utils.get_datetime_in_timezone(tz))
    local_now = aware[:19]
    offset = aware[-6:]
    osec = (1 if offset[0] == "+" else -1) * (int(offset[1:3]) * 3600 + int(offset[4:6]) * 60)
    tz_names = {"Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT"}
    tz_label = tz_names.get(tz)
    if not tz_label:
        tz_label = "GMT" + offset[0] + str(int(offset[1:3]))
        if offset[4:6] != "00":
            tz_label = tz_label + ":" + offset[4:6]

    epoch0 = "1970-01-01 00:00:00"
    now_s = frappe.utils.time_diff_in_seconds(str(frappe.utils.get_datetime_in_timezone("UTC"))[:19], epoch0)
    cap_ms = 0.0
    offline = str(fd.get("offline") or "0") == "1"
    flags = []
    time_value = local_now
    claimed = None
    skew = 0
    age = 0
    if offline:
        def setting(field, default):
            v = frappe.db.get_single_value("Attendance Offline Settings", field)
            return v if v else default
        max_age_h = setting("max_age_hours", 24)
        skew_tol = setting("skew_tolerance_seconds", 300)
        max_month = setting("max_per_month", 5)
        future_tol = setting("future_tolerance_seconds", 120)
        max_anchor_h = setting("max_anchor_age_hours", 72)
        cap_ms = frappe.utils.flt(fd.get("captured_ms"))
        dev_ms = frappe.utils.flt(fd.get("device_ms"))
        trusted = str(fd.get("trusted") or "0") == "1"
        anchor_age = frappe.utils.flt(fd.get("anchor_age_s"))
        cap_s = cap_ms / 1000.0
        dev_s = dev_ms / 1000.0
        if not trusted or cap_ms <= 0:
            flags.append("time unverified")
        else:
            age = now_s - cap_s
            if cap_s > now_s + future_tol:
                flags.append("claimed time in the future")
            if age > max_age_h * 3600:
                flags.append("queue older than " + str(int(max_age_h)) + "h")
            if dev_ms > 0:
                skew = abs(dev_s - cap_s)
                if skew > skew_tol:
                    flags.append("clock changed (skew " + str(int(skew)) + "s)")
            else:
                flags.append("device time missing")
            if anchor_age > max_anchor_h * 3600:
                flags.append("last server contact too old")
        month_start = local_now[:8] + "01 00:00:00"
        if frappe.db.count("Employee Checkin", {"employee": me[0].name, "custom_offline": 1,
                                                 "time": [">=", month_start]}) >= max_month:
            flags.append("monthly offline quota exceeded")
        # waktu klaim (dalam zona kerja) hanya bila masuk akal: dari 7 hari lalu s.d. sekarang + toleransi
        for cand in (cap_s if (trusted and cap_ms > 0) else 0, dev_s):
            if claimed is None and cand > 0 and cand <= now_s + future_tol and cand >= now_s - 7 * 86400:
                claimed = str(frappe.utils.add_to_date(frappe.utils.get_datetime(epoch0), seconds=cand + osec))[:19]
        if not flags:
            time_value = claimed
            last = frappe.get_all("Employee Checkin", filters={"employee": me[0].name}, fields=["time"],
                                  order_by="time desc", limit_page_length=1)
            if last and str(last[0].time)[:19] > time_value:
                frappe.throw("Offline check-in is earlier than your last recorded check-in")
        else:
            time_value = local_now
            # beberapa item antrean mencurigakan dapat tiba dalam detik yang sama: geser 1 detik agar tidak bentrok
            for i in range(60):
                if not frappe.db.exists("Employee Checkin", {"employee": me[0].name, "time": time_value}):
                    break
                time_value = str(frappe.utils.add_to_date(frappe.utils.get_datetime(time_value), seconds=1))[:19]
    # ---- Geofence dan validasi GPS (tidak mengubah penentuan jam di atas) ----
    def gsetting(field, default):
        v = frappe.db.get_single_value("Geofence Settings", field)
        return v if v else default
    mode = frappe.db.get_single_value("Geofence Settings", "geofence_mode") or "Flag"
    geo_flags = []
    geo_status = "No Location"
    dist = 0
    work_loc = None
    gps_acc = frappe.utils.flt(fd.get("accuracy_m"))
    gps_skew = 0
    mocked = str(fd.get("mocked") or "0") == "1"
    lat = 0
    lng = 0
    has_loc = fd.get("lat") not in (None, "") and fd.get("lng") not in (None, "")
    if has_loc:
        lat = frappe.utils.flt(fd.get("lat"))
        lng = frappe.utils.flt(fd.get("lng"))
        best_d = None
        best_wl = None
        for wl in frappe.get_all("Work Location", filters={"active": 1},
                                 fields=["location_name", "latitude", "longitude", "radius_m"],
                                 limit_page_length=100):
            r = wl.latitude * 0.017453292519943295
            cosr = 1 - r * r / 2 + r * r * r * r / 24 - r * r * r * r * r * r / 720
            dx = (lng - wl.longitude) * 111320.0 * cosr
            dy = (lat - wl.latitude) * 110574.0
            d = (dx * dx + dy * dy) ** 0.5
            if best_d is None or d < best_d:
                best_d = d
                best_wl = wl
        if best_wl is not None:
            dist = int(best_d)
            work_loc = best_wl.location_name
            tol = 0
            if gps_acc > 0:
                tol = gps_acc if gps_acc < 50 else 50
            if best_d <= best_wl.radius_m + tol:
                geo_status = "Inside"
            else:
                geo_status = "Outside"
                if not trips:
                    geo_flags.append("outside geofence (" + str(dist) + " m from " + str(work_loc) + ")")
        if gps_acc > gsetting("max_accuracy_m", 100):
            geo_flags.append("GPS accuracy too low (" + str(int(gps_acc)) + " m)")
        gps_ms = frappe.utils.flt(fd.get("gps_ms"))
        if gps_ms > 0:
            ref_s = now_s
            if offline and cap_ms > 0:
                ref_s = cap_ms / 1000.0
            gps_skew = abs(gps_ms / 1000.0 - ref_s)
            if gps_skew > gsetting("gps_skew_tolerance_seconds", 300):
                geo_flags.append("GPS time differs from device time (" + str(int(gps_skew)) + "s)")
        if mocked and frappe.db.get_single_value("Geofence Settings", "block_mock_location") != 0:
            geo_flags.append("location is mocked")
    elif frappe.db.get_single_value("Geofence Settings", "require_location"):
        geo_flags.append("no location provided")
    if mode == "Off":
        geo_flags = []
    if geo_flags and mode == "Block":
        frappe.throw("Check-in blocked: " + "; ".join(geo_flags))
    all_flags = flags + geo_flags
    if offline and not flags and not claimed:
        claimed = time_value
    review = "Needs Review" if all_flags else "None"
    doc = frappe.get_doc({"doctype": "Employee Checkin", "employee": me[0].name, "log_type": log_type,
                          "time": time_value, "device_id": "hris-mobile", "custom_timezone": tz,
                          "custom_offline": 1 if offline else 0, "custom_clock_skew_seconds": int(skew),
                          "custom_queue_age_seconds": int(age) if offline else 0, "custom_claimed_time": claimed,
                          "custom_review_status": review, "custom_flags": "; ".join(all_flags),
                          "latitude": lat if has_loc else None, "longitude": lng if has_loc else None,
                          "custom_distance_m": dist, "custom_gps_accuracy_m": gps_acc,
                          "custom_gps_skew_seconds": int(gps_skew), "custom_mocked": 1 if mocked else 0,
                          "custom_geo_status": geo_status, "custom_work_location": work_loc,
                          "custom_client_id": client_id or None})
    doc.insert(ignore_permissions=True)
    if all_flags:
        recipients = []
        if me[0].reports_to:
            boss = frappe.db.get_value("Employee", me[0].reports_to, "user_id")
            if boss:
                recipients.append(boss)
        for u in frappe.get_all("Has Role", filters={"role": ["in", ["HR Manager", "HR User"]], "parenttype": "User"},
                                pluck="parent", limit_page_length=100):
            if u != "Administrator" and u not in recipients:
                recipients.append(u)
        for u in recipients:
            if u != frappe.session.user:
                frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": u,
                                "subject": ("Offline check-in needs review: " if offline else "Check-in needs review: ") + str(me[0].employee_name),
                                "email_content": "; ".join(all_flags), "document_type": "Employee Checkin",
                                "document_name": doc.name}).insert(ignore_permissions=True)
    frappe.response["message"] = {"name": doc.name, "log_type": log_type, "time": time_value, "timezone": tz,
                                  "timezone_label": tz_label, "offline": 1 if offline else 0,
                                  "review_status": review, "flags": all_flags,
                                  "geo_status": geo_status, "distance_m": dist}
