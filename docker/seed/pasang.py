"""Bagian seed yang aman untuk data klien: field yang dibutuhkan skrip, menu desk, dan Server Script.
Dipakai seed.py (mode penuh dan mode --skrip). Semua fungsi idempoten dan mengandaikan frappe sudah tersambung."""
import os
import frappe


def log(msg):
    print("[seed]", msg)


GUEST_SCRIPTS = {"hris_get_app_update", "hris_get_langganan"}  # API tanpa login (dipanggil aplikasi sebelum masuk)
EVENT_SCRIPTS = {  # script berbasis event dokumen: nama_file -> (DocType, event)
    "hris_notify_leave_created": ("Leave Application", "After Insert"),
    "hris_notify_leave_decided": ("Leave Application", "After Save"),
    "hris_notify_payslip": ("Salary Slip", "After Submit"),
    "hris_notify_attendance_correction": ("Attendance Request", "After Submit"),
    "hris_notify_document_status": ("Employee Document", "After Save"),
    "hris_notify_device": ("Registered Device", "After Save"),
    "hris_link_attachment": ("File", "After Insert"),
    "hris_guard_document_upload": ("File", "Before Insert"),
    "hris_employee_tax_status": ("Employee", "Before Save"),
    "hris_leave_rules": ("Leave Application", "Before Save"),
    "hris_shift_location_map": ("Shift Location", "Before Save"),
    "hris_salary_slip_pph21": ("Salary Slip", "Before Save"),
    "hris_announcement_publish": ("HR Announcement", "Before Save"),
    "hris_notify_announcement": ("HR Announcement", "After Save"),
    "hris_push_on_notification": ("Notification Log", "After Insert"),
    "hris_notify_shift_created": ("Shift Request", "After Insert"),
    "hris_notify_shift_decided": ("Shift Request", "After Submit"),
    "hris_notify_encashment_created": ("Leave Encashment", "After Insert"),
    "hris_notify_encashment_done": ("Leave Encashment", "After Submit"),
    "hris_notify_promotion": ("Employee Promotion", "After Submit"),
    "hris_notify_separation": ("Employee Separation", "After Submit"),
    "hris_notify_training": ("Training Event", "After Submit"),
    "hris_notify_exit_interview": ("Exit Interview", "After Save"),
    "hris_notify_grievance": ("Employee Grievance", "After Save"),
}


def skema():
    # Tutorial aplikasi hanya tampil sekali per perangkat terdaftar, juga setelah pasang ulang.
    if frappe.db.exists("DocType", "Registered Device") and not frappe.get_meta("Registered Device").has_field("tutorial_seen"):
        doc = frappe.get_doc("DocType", "Registered Device")
        doc.append("fields", dict(fieldname="tutorial_seen", label="Tutorial Seen", fieldtype="Check", read_only=1))
        doc.flags.ignore_permissions = True
        doc.save()
        frappe.db.commit()
        frappe.clear_cache(doctype="Registered Device")
        log("Registered Device: field tutorial_seen ditambahkan")


def menu():
    # Sidebar modul Leaves (v16): tautan ke Overtime Request dan Travel Request lewat lapisan
    # kustom situs (Custom Sidebar), cara resmi menambah item tanpa mengubah sidebar bawaan hrms.
    # Workspace "HR Requests" percobaan lama dihapus.
    for _dt in ("Workspace", "Workspace Sidebar"):
        if frappe.db.exists(_dt, "HR Requests"):
            frappe.delete_doc(_dt, "HR Requests", ignore_permissions=True, force=True)
            log(f"{_dt} HR Requests dihapus")
    if frappe.db.exists("Sidebar", "Leaves"):
        from frappe.desk.doctype.custom_sidebar.custom_sidebar import add_site_sidebar_item
        for _dt, _ic in (("Overtime Request", "clock"), ("Travel Request", "briefcase")):
            add_site_sidebar_item("Leaves", dict(label=_dt, type="Link", link_type="DocType", link_to=_dt,
                                                 icon=_ic, collapsible=1))
        log("sidebar Leaves: tautan Overtime Request dan Travel Request")
        # Urutan: tepat di bawah Leave Application (secara bawaan item tambahan jatuh di paling bawah).
        from frappe.desk.doctype.custom_sidebar.custom_sidebar import _save_customization, layer_arrangement
        _arr = layer_arrangement("Leaves", None)
        _mine = [r for r in _arr if r.get("link_to") in ("Overtime Request", "Travel Request")]
        _rest = [r for r in _arr if r not in _mine]
        _at = next((n for n, r in enumerate(_rest) if r.get("link_to") == "Leave Application"), 0) + 1
        _mine.sort(key=lambda r: ["Overtime Request", "Travel Request"].index(r["link_to"]))
        _save_customization("Leaves", _rest[:_at] + _mine + _rest[_at:], None)
        log("sidebar Leaves: diurutkan di bawah Leave Application")
    frappe.db.commit()
    frappe.clear_cache()

    if frappe.db.exists("Sidebar", "HR Setup"):
        from frappe.desk.doctype.custom_sidebar.custom_sidebar import add_site_sidebar_item as _asd
        _asd("HR Setup", dict(label="Registered Device", type="Link", link_type="DocType", link_to="Registered Device",
                              icon="mobile", collapsible=1))
        frappe.db.commit()

    # Sidebar: "Offline Check-in Review" di bawah "Employee Checkin" (Shift and Attendance).
    if frappe.db.exists("Sidebar", "Shift & Attendance"):
        from frappe.desk.doctype.custom_sidebar.custom_sidebar import add_site_sidebar_item, _save_customization, layer_arrangement
        add_site_sidebar_item("Shift and Attendance", dict(label="Offline Check-in Review", type="Link", link_type="DocType",
                                                            link_to="Employee Checkin", icon="clock", collapsible=1,
                                                            route_options='{"custom_review_status": "Needs Review"}'))
        add_site_sidebar_item("Shift and Attendance", dict(label="WFH Schedule", type="Link", link_type="DocType",
                                                            link_to="WFH Schedule", icon="calendar", collapsible=1))
        _arr = layer_arrangement("Shift and Attendance", None)
        _mine = [r for r in _arr if r.get("label") == "Offline Check-in Review"]
        _rest = [r for r in _arr if r not in _mine]
        _at = next((n for n, r in enumerate(_rest) if r.get("link_to") == "Employee Checkin" and r.get("label") == "Employee Checkin"), 0) + 1
        _wfh = [r for r in _rest if r.get("label") == "WFH Schedule"]
        _rest = [r for r in _rest if r not in _wfh]
        _at = next((n for n, r in enumerate(_rest) if r.get("link_to") == "Employee Checkin" and r.get("label") == "Employee Checkin"), 0) + 1
        _ar = next((n for n, r in enumerate(_rest) if r.get("link_to") == "Attendance Request"), None)
        _rest = _rest[:_at] + _mine + _rest[_at:]
        if _ar is not None:
            _ar = next((n for n, r in enumerate(_rest) if r.get("link_to") == "Attendance Request"), _ar)
            _rest = _rest[:_ar + 1] + _wfh + _rest[_ar + 1:]
        else:
            _rest = _rest + _wfh
        _save_customization("Shift and Attendance", _rest, None)
        frappe.db.commit()
        log("sidebar: Offline Check-in Review di bawah Employee Checkin, WFH Schedule di bawah Attendance Request")
        frappe.clear_cache()

    if frappe.db.exists("Sidebar", "HR Setup"):
        from frappe.desk.doctype.custom_sidebar.custom_sidebar import add_site_sidebar_item as _asi
        _asi("HR Setup", dict(label="App Update", type="Link", link_type="DocType", link_to="App Update", icon="upload",
                              collapsible=1))
        frappe.db.commit()

    # Sidebar HR Setup: Profile Change Request, Face Enrollment, Face Settings. Sebelumnya Profile Change Request ada di Leaves
    # dan tautan wajah salah nama sidebar; yang salah tempat dibersihkan dari lapisan kustom Leaves / Shift and Attendance.
    if frappe.db.exists("Sidebar", "HR Setup"):
        from frappe.desk.doctype.custom_sidebar.custom_sidebar import (
            add_site_sidebar_item, _save_customization, layer_arrangement)
        _salah = {"Leaves": ("Profile Change Request",),
                  "Shift and Attendance": ("Face Enrollment", "Face Settings", "HR Announcement")}
        for _mod, _dts in _salah.items():
            try:
                _arr = layer_arrangement(_mod, None)
            except Exception:
                continue
            _sisa = [r for r in _arr if r.get("link_to") not in _dts]
            if len(_sisa) != len(_arr):
                _save_customization(_mod, _sisa, None)
                log("sidebar " + _mod + ": " + ", ".join(_dts) + " dipindahkan ke HR Setup")
        for _dt, _ic in (("Profile Change Request", "user"),):
            add_site_sidebar_item("HR Setup", dict(label=_dt, type="Link", link_type="DocType", link_to=_dt, icon=_ic,
                                                    collapsible=1))
        frappe.db.commit()
        frappe.clear_cache()
        # Semua yang berhubungan dengan wajah dikelompokkan dalam satu bagian "Face Verification" (bisa dilipat, seperti
        # "Masters"): Face Enrollment, Face Check Attempt, Face Settings. Idempoten.
        _FACE = ("Face Enrollment", "Face Check Attempt", "Face Settings")
        _arr = layer_arrangement("HR Setup", None)
        _ada = any(r.get("label") == "Face Verification" and r.get("type") == "Section Break" for r in _arr)
        _anak = [r.get("link_to") for r in _arr if r.get("child") and r.get("link_to") in _FACE]
        if not _ada or sorted(_anak) != sorted(_FACE):
            _baru = [r for r in _arr if r.get("link_to") not in _FACE and not (
                r.get("label") == "Face Verification" and r.get("type") == "Section Break")]
            # added=1: baris milik lapisan situs ini (tanpa itu dianggap rujukan ke item dasar yang tidak ada, lalu dibuang).
            _grup = [dict(label="Face Verification", type="Section Break", icon="scan-face", collapsible=1, child=0,
                          indent=1, added=1)]
            for _dt in _FACE:
                _grup.append(dict(label=_dt, type="Link", link_type="DocType", link_to=_dt, collapsible=1, child=1,
                                  indent=0, added=1))
            _pos = next((i + 1 for i, r in enumerate(_baru) if r.get("link_to") == "Profile Change Request"), len(_baru))
            _save_customization("HR Setup", _baru[:_pos] + _grup + _baru[_pos:], None)
            frappe.db.commit()
            frappe.clear_cache()
            log("sidebar HR Setup: bagian Face Verification (Face Enrollment, Face Check Attempt, Face Settings)")

    # HR Setup: HR Announcement, lalu bagian "Geofence & Office Location" (Geofence Settings, Shift Location). Idempoten.
    if frappe.db.exists("Sidebar", "HR Setup"):
        from frappe.desk.doctype.custom_sidebar.custom_sidebar import _save_customization, layer_arrangement
        _GEO = ("Geofence Settings", "Shift Location")
        _arr = layer_arrangement("HR Setup", None)
        _anak = [r.get("link_to") for r in _arr if r.get("child") and r.get("link_to") in _GEO]
        if sorted(_anak) != sorted(_GEO) or not any(r.get("link_to") == "HR Announcement" for r in _arr):
            _baru = [r for r in _arr if r.get("link_to") not in _GEO + ("HR Announcement",)
                     and r.get("label") != "Geofence & Office Location"]
            _grup = [dict(label="HR Announcement", type="Link", link_type="DocType", link_to="HR Announcement",
                          icon="bell", collapsible=1, child=0, indent=0, added=1),
                     dict(label="Geofence & Office Location", type="Section Break", icon="map-pin", collapsible=1,
                          child=0, indent=1, added=1)]
            for _dt in _GEO:
                _grup.append(dict(label=_dt, type="Link", link_type="DocType", link_to=_dt, collapsible=1, child=1,
                                  indent=0, added=1))
            _save_customization("HR Setup", _baru + _grup, None)
            frappe.db.commit()
            frappe.clear_cache()
            log("sidebar HR Setup: HR Announcement dan bagian Geofence & Office Location")
    frappe.db.commit()
    frappe.clear_cache()


def server_script(SS_DIR):
    def exists(dt, name):
        return frappe.db.exists(dt, name)

    def make(d):
        doc = frappe.get_doc(d)
        doc.insert(ignore_permissions=True)
        log(f"dibuat {doc.doctype}: {doc.name}")

    # 9. Server Script (satu file .py per script, nama file = nama method API) ----------

    if os.path.isdir(SS_DIR):
        for fname in sorted(os.listdir(SS_DIR)):
            if not fname.endswith(".py"):
                continue
            name = fname[:-3]
            code = open(os.path.join(SS_DIR, fname), encoding="utf-8").read()
            # "# @include: _lib/xxx.py" disisipkan apa adanya, dengan indentasi baris include (Server Script tidak bisa import)
            _out = []
            for _ln in code.split("\n"):
                if _ln.startswith("# @fitur: "):  # fitur berbayar: tolak bila tidak termasuk paket HRIS Subscription site ini
                    _out.extend(open(os.path.join(SS_DIR, "_lib/paket_lib.py"), encoding="utf-8").read().rstrip("\n").split("\n"))
                    _out += [f'if "{_ln[len("# @fitur: "):].strip()}" not in pk_info()["fitur"]:',
                             '    frappe.throw("This feature is not included in your subscription plan", frappe.PermissionError)']
                elif _ln.strip().startswith("# @include: "):
                    _ind = _ln[:len(_ln) - len(_ln.lstrip())]
                    _snip = open(os.path.join(SS_DIR, _ln.strip()[len("# @include: "):].strip()), encoding="utf-8").read().rstrip("\n")
                    _out.extend([(_ind + _l if _l.strip() else _l) for _l in _snip.split("\n")])
                else:
                    _out.append(_ln)
            code = "\n".join(_out)
            vals = dict(script_type="API", api_method=name, allow_guest=1 if name in GUEST_SCRIPTS else 0, disabled=0, script=code)
            if name in EVENT_SCRIPTS:  # script berbasis event dokumen, bukan API
                vals = dict(script_type="DocType Event", reference_doctype=EVENT_SCRIPTS[name][0],
                            doctype_event=EVENT_SCRIPTS[name][1], disabled=0, script=code)
            if name == "hris_announcement_visibility":  # Permission Query
                vals = dict(script_type="Permission Query", reference_doctype="HR Announcement", disabled=0, script=code)
            if exists("Server Script", name):
                doc = frappe.get_doc("Server Script", name)
                if any(doc.get(k) != v for k, v in vals.items()):
                    doc.update(vals)
                    doc.save(ignore_permissions=True)
                    log(f"diperbarui Server Script: {name}")
            else:
                make(dict(doctype="Server Script", name=name, **vals))
        frappe.db.commit()
        frappe.clear_cache()
