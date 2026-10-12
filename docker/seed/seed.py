"""Seed idempotent data uji HRIS. Dijalankan DI DALAM container backend oleh seed.sh.
Semua langkah memeriksa keberadaan data lebih dulu, jadi aman dijalankan berulang.
Password dibaca dari environment (diteruskan seed.sh dari docker/.credentials.local)."""
import os
import json
import frappe
from frappe.utils import nowdate

SITE = os.environ.get("SITE_NAME", "hris.localhost")
frappe.init(site=SITE, sites_path="/home/frappe/frappe-bench/sites")
frappe.connect()
frappe.set_user("Administrator")
Y = int(nowdate()[:4])
C, ABBR = "Falah Test", "FT"
HL = f"Holiday {Y}"
SS_DIR = os.environ.get("SERVER_SCRIPTS_DIR", "/tmp/hris-seed/server-scripts")


def log(msg):
    print("[seed]", msg)


def exists(dt, name_or_filters):
    return frappe.db.exists(dt, name_or_filters)


def make(d, submit=False):
    doc = frappe.get_doc(d)
    doc.insert(ignore_permissions=True)
    if submit:
        doc.submit()
    log(f"dibuat {doc.doctype}: {doc.name}")
    return doc


# 1. Setup wizard ----------------------------------------------------------
if not frappe.db.get_single_value("System Settings", "setup_complete"):
    from frappe.desk.page.setup_wizard.setup_wizard import setup_complete

    setup_complete(dict(
        language="en", country="Indonesia", timezone="Asia/Jakarta", currency="IDR",
        company_name=C, company_abbr=ABBR, domains=["Services"], chart_of_accounts="Standard",
        fy_start_date=f"{Y}-01-01", fy_end_date=f"{Y}-12-31", company_tagline="",
        bank_account="Bank", full_name="Administrator", email="admin@example.com"))
    frappe.db.commit()
    log("setup wizard selesai")
frappe.db.commit()

# 1b. Migrasi nama master data Indonesia -> Inggris (rename_doc: semua tautan ikut berpindah).
RENAMES = [
    ("Leave Type", "Cuti Tahunan", "Annual Leave"), ("Leave Type", "Cuti Sakit", "Sick Leave"),
    ("Department", f"Keuangan - {ABBR}", f"Finance - {ABBR}"),
    ("Department", f"People Ops - {ABBR}", f"People Operations - {ABBR}"),
    ("Designation", "Staf Keuangan", "Finance Staff"), ("Designation", "Manajer Keuangan", "Finance Manager"),
    ("Designation", "Staf HR", "HR Staff"),
    ("Shift Type", "Shift Pagi", "Morning Shift"), ("Holiday List", f"Libur {Y}", f"Holiday {Y}"),
    ("Salary Component", "Gaji Pokok", "Basic Salary"), ("Salary Component", "Tunjangan Transport", "Transport Allowance"),
    ("Salary Component", "Tunjangan Makan", "Meal Allowance"), ("Salary Component", "Tunjangan Jabatan", "Position Allowance"),
    ("Salary Component", "BPJS Kesehatan", "BPJS Health"), ("Salary Component", "PPh 21", "Income Tax (PPh 21)"),
    ("Salary Structure", "Struktur Gaji Standar", "Standard Salary Structure"),
]
frappe.flags.in_patch = True  # izinkan rename untuk doctype yang tidak allow_rename
for _dt, _old, _new in RENAMES:
    if frappe.db.exists(_dt, _old):
        # bila nama baru sudah ada (mis. "Sick Leave" bawaan ERPNext), gabungkan: tautan ikut pindah
        _merge = bool(frappe.db.exists(_dt, _new))
        frappe.rename_doc(_dt, _old, _new, force=True, merge=_merge)
        log(f"rename {_dt}: {_old} -> {_new}" + (" (merge)" if _merge else ""))
frappe.flags.in_patch = False
for _dt, _name, _field, _old, _new in [
    ("Leave Type", "Annual Leave", "leave_type_name", "Cuti Tahunan", "Annual Leave"),
    ("Leave Type", "Sick Leave", "leave_type_name", "Cuti Sakit", "Sick Leave"),
    ("Department", f"Finance - {ABBR}", "department_name", "Keuangan", "Finance"),
    ("Department", f"People Operations - {ABBR}", "department_name", "People Ops", "People Operations"),
    ("Designation", "Finance Staff", "designation_name", "Staf Keuangan", "Finance Staff"),
    ("Designation", "Finance Manager", "designation_name", "Manajer Keuangan", "Finance Manager"),
    ("Designation", "HR Staff", "designation_name", "Staf HR", "HR Staff"),
    ("Holiday List", f"Holiday {Y}", "holiday_list_name", f"Libur {Y}", f"Holiday {Y}"),
]:
    if frappe.db.exists(_dt, _name) and frappe.db.get_value(_dt, _name, _field) == _old:
        frappe.db.set_value(_dt, _name, _field, _new)
_lp = frappe.db.get_value("Leave Policy", {"title": "Kebijakan Cuti Standar"})
if _lp:
    frappe.db.set_value("Leave Policy", _lp, "title", "Standard Leave Policy")
for _f in ("relation", "custom_em2_relation"):
    if frappe.db.has_column("Employee", _f):
        for _ind, _en in {"Ibu": "Mother", "Ayah": "Father", "Kakak": "Sibling", "Adik": "Sibling", "Suami": "Spouse"}.items():
            frappe.db.sql(f"update `tabEmployee` set `{_f}`=%s where `{_f}`=%s", (_en, _ind))
frappe.db.commit()

# 2. Holiday list ----------------------------------------------------------
if not exists("Holiday List", HL):
    make(dict(doctype="Holiday List", holiday_list_name=HL, from_date=f"{Y}-01-01",
              to_date=f"{Y}-12-31", weekly_off="Sunday", holidays=[
                  dict(holiday_date=f"{Y}-01-01", description="Tahun Baru"),
                  dict(holiday_date=f"{Y}-08-17", description="Hari Kemerdekaan RI"),
                  dict(holiday_date=f"{Y}-12-25", description="Hari Natal")]))

# 3. Department, designation, leave type, policy ---------------------------
for d in ["Finance", "People Operations"]:
    if not exists("Department", f"{d} - {ABBR}"):
        make(dict(doctype="Department", department_name=d, company=C, parent_department="All Departments"))
for dg in ["Finance Manager", "Finance Staff", "HR Staff"]:
    if not exists("Designation", dg):
        make(dict(doctype="Designation", designation_name=dg))
for lt in ["Annual Leave", "Sick Leave"]:
    if not exists("Leave Type", lt):
        make(dict(doctype="Leave Type", leave_type_name=lt, include_holiday=0, max_leaves_allowed=12))
LP = "Standard Leave Policy"
if not exists("Leave Policy", {"title": LP}):
    make(dict(doctype="Leave Policy", title=LP, leave_policy_details=[
        dict(leave_type="Annual Leave", annual_allocation=12),
        dict(leave_type="Sick Leave", annual_allocation=12)]), submit=True)
LP_NAME = frappe.db.get_value("Leave Policy", {"title": LP}, "name")
if not exists("Shift Type", "Morning Shift"):
    make(dict(doctype="Shift Type", name="Morning Shift", start_time="08:00:00", end_time="17:00:00"))
# Auto attendance: Employee Checkin diubah jadi Attendance oleh scheduler.
# process_attendance_after / last_sync_of_checkin hanya diisi saat pertama kali diaktifkan,
# supaya log lama (sebelum hari ini - 1) tidak ikut diproses dan seed ulang tidak me-reset.
_st = frappe.get_doc("Shift Type", "Morning Shift")
_want = dict(enable_auto_attendance=1, auto_update_last_sync=1,
             begin_check_in_before_shift_start_time=60, allow_check_out_after_shift_end_time=60,
             enable_late_entry_marking=1, late_entry_grace_period=10,
             enable_early_exit_marking=1, early_exit_grace_period=10,
             working_hours_threshold_for_half_day=4, working_hours_threshold_for_absent=2)
_first = not _st.enable_auto_attendance
if _first:
    _want["process_attendance_after"] = frappe.utils.add_days(nowdate(), -1)
    _want["last_sync_of_checkin"] = frappe.utils.now_datetime()
if any(_st.get(k) != v for k, v in _want.items()):
    _st.update(_want)
    _st.save(ignore_permissions=True)
    log("Shift Pagi: auto attendance dikonfigurasi")
frappe.db.commit()

# 4. Employee --------------------------------------------------------------
EMPLOYEES = [  # (key, first, last, gender, dept, designation)
    ("rani", "Rani", "Test", "Female", "Finance", "Finance Staff"),
    ("budi", "Budi", "Santoso", "Male", "Finance", "Finance Staff"),
    ("dewi", "Dewi", "Kusuma", "Female", "Finance", "Finance Manager"),
    ("sari", "Sari", "Wulandari", "Female", "People Operations", "HR Staff"),
    ("agus", "Agus", "Pratama", "Male", "Finance", "Finance Staff"),   # tanpa user login
    ("maya", "Maya", "Lestari", "Female", "People Operations", "HR Staff"),     # tanpa user login
]
emp = {}
for key, fn, ln, g, dep, des in EMPLOYEES:
    n = frappe.db.get_value("Employee", {"first_name": fn, "last_name": ln}, "name")
    if not n:
        n = make(dict(doctype="Employee", first_name=fn, last_name=ln, gender=g,
                      date_of_birth="1995-05-10", date_of_joining=f"{Y-1}-01-02", company=C,
                      department=f"{dep} - {ABBR}", designation=des, status="Active",
                      holiday_list=HL, create_user_permission=0)).name
    emp[key] = n

# 5. User ------------------------------------------------------------------
PW = {
    "rani": os.environ.get("USER_PASSWORD"),
    "dewi": os.environ.get("MSS_USER_PASSWORD"),
    "sari": os.environ.get("HR_USER_PASSWORD"),
}
USERS = {  # key: (email, first_name, roles)
    "rani": (os.environ.get("USER_EMAIL", "rani.test@example.com"), "Rani", ["Employee"]),
    "dewi": (os.environ.get("MSS_USER_EMAIL", "mss.test@example.com"), "Dewi", ["Employee", "Leave Approver"]),
    "sari": (os.environ.get("HR_USER_EMAIL", "hr.test@example.com"), "Sari",
             ["Employee", "HR User", "HR Manager", "Leave Approver"]),
}
def ensure_roles():
    for _key, (_email, _first, _roles) in USERS.items():
        u = frappe.get_doc("User", _email)
        have = {r.role for r in u.roles}
        # role "Employee" kadang hilang setelah insert user, jadi selalu dicek ulang.
        missing = [r for r in _roles if r not in have]
        if missing:
            u.add_roles(*missing)
            log(f"{_email}: tambah role {missing}")
        extra = [r for r in have if r in ("Leave Approver", "HR User", "HR Manager") and r not in _roles]
        if extra:
            u.remove_roles(*extra)
            log(f"{_email}: hapus role {extra}")
    frappe.db.commit()


for key, (email, first, roles) in USERS.items():
    if not exists("User", email):
        if not PW[key]:
            raise SystemExit(f"password untuk {email} tidak diberikan (cek .credentials.local)")
        u = frappe.get_doc(dict(doctype="User", email=email, first_name=first, enabled=1,
                                send_welcome_email=0, user_type="System User", new_password=PW[key]))
        u.flags.ignore_password_policy = True
        u.insert(ignore_permissions=True)
        log(f"dibuat user {email}")
    frappe.db.set_value("Employee", emp[key], "user_id", email)
ensure_roles()
mail = {k: v[0] for k, v in USERS.items()}
frappe.db.set_value("Employee", emp["rani"], "leave_approver", mail["dewi"])
frappe.db.set_value("Employee", emp["budi"], "leave_approver", mail["sari"])
frappe.db.set_value("Employee", emp["dewi"], "leave_approver", mail["sari"])
frappe.db.set_value("Employee", emp["sari"], "leave_approver", mail["dewi"])
frappe.db.commit()

# 5b. Data profil untuk direktori karyawan (menimpa nilai, jadi idempoten)
PROFILE = {  # key: (nomor, reports_to key, employment_type, contract_end)
    "rani": ("EMP-0001", "dewi", "Full-time", None),
    "budi": ("EMP-0002", "dewi", "Contract", f"{Y+1}-05-31"),
    "dewi": ("EMP-0003", "sari", "Full-time", None),
    "sari": ("EMP-0004", None, "Full-time", None),
    "agus": ("EMP-0005", "dewi", "Full-time", None),
    "maya": ("EMP-0006", "sari", "Full-time", None),
}
for i, (key, (no, boss, et, ce)) in enumerate(PROFILE.items(), start=1):
    frappe.db.set_value("Employee", emp[key], {
        "employee_number": no,
        "reports_to": emp[boss] if boss else None,
        "employment_type": et,
        "contract_end_date": ce,
        "company_email": f"{key}@falahtest.example",
        "cell_number": f"0812-0000-{i:04d}",
    })
frappe.db.commit()

# 6. User Permission: ESS/MSS hanya melihat Employee dirinya sendiri --------
for key in ("rani", "dewi"):
    if not exists("User Permission", {"user": mail[key], "allow": "Employee", "for_value": emp[key]}):
        make(dict(doctype="User Permission", user=mail[key], allow="Employee",
                  for_value=emp[key], apply_to_all_doctypes=1))
frappe.db.commit()

# 7. Holiday List Assignment (wajib di v16), alokasi cuti, shift -----------------
for t, n in [("Company", C)] + [("Employee", e) for e in emp.values()]:
    if not exists("Holiday List Assignment", {"applicable_for": t, "assigned_to": n, "docstatus": 1}):
        make(dict(doctype="Holiday List Assignment", applicable_for=t, assigned_to=n,
                  holiday_list=HL, from_date=f"{Y}-01-01"), submit=True)
for e in emp.values():
    if not exists("Leave Policy Assignment", {"employee": e, "docstatus": 1}):
        make(dict(doctype="Leave Policy Assignment", employee=e, leave_policy=LP_NAME,
                  effective_from=f"{Y}-01-01", effective_to=f"{Y}-12-31", assignment_based_on=""), submit=True)
    if not exists("Shift Assignment", {"employee": e, "docstatus": 1}):
        make(dict(doctype="Shift Assignment", employee=e, shift_type="Morning Shift", company=C,
                  start_date=f"{Y}-01-01", end_date=f"{Y}-12-31", status="Active"), submit=True)
frappe.db.commit()

# 7b. Pengaturan gaji per karyawan (isi di form Employee, tab/section "Pengaturan Gaji").
# permlevel 1: hanya HR User / HR Manager yang boleh melihat dan mengubah.
_payroll_fields_created = False
for cf in [
    dict(fieldname="custom_pengaturan_gaji", label="Salary Settings", fieldtype="Section Break",
         permlevel=1, insert_after="ctc"),
    dict(fieldname="custom_tunjangan_jabatan", label="Position Allowance (IDR)", fieldtype="Currency",
         default="0", permlevel=1, insert_after="custom_pengaturan_gaji"),
    dict(fieldname="custom_tarif_bpjs_kesehatan", label="BPJS Health Rate (%)", fieldtype="Float",
         default="1", permlevel=1, insert_after="custom_tunjangan_jabatan"),
    dict(fieldname="custom_tarif_bpjs_jht", label="BPJS JHT Rate (%)", fieldtype="Float",
         default="2", permlevel=1, insert_after="custom_tarif_bpjs_kesehatan"),
    dict(fieldname="custom_tarif_bpjs_jp", label="BPJS JP Rate (%)", fieldtype="Float",
         default="1", permlevel=1, insert_after="custom_tarif_bpjs_jht"),
    dict(fieldname="custom_tarif_pph21", label="Income Tax (PPh 21) Rate (%)", fieldtype="Float",
         default="0", permlevel=1, insert_after="custom_tarif_bpjs_jp",
         description="Manual rate. Leave 0 to calculate PPh 21 automatically from the TER table."),
]:
    if not frappe.db.exists("Custom Field", {"dt": "Employee", "fieldname": cf["fieldname"]}):
        make(dict(doctype="Custom Field", dt="Employee", **cf))
        _payroll_fields_created = True
if _payroll_fields_created:
    frappe.clear_cache(doctype="Employee")
for _role in ("HR User", "HR Manager"):
    if not frappe.db.exists("Custom DocPerm", {"parent": "Employee", "role": _role, "permlevel": 1}):
        from frappe.permissions import add_permission, update_permission_property
        add_permission("Employee", _role, 1)
        update_permission_property("Employee", _role, 1, "write", 1)
        log(f"izin permlevel 1 Employee untuk {_role} ditambahkan")
frappe.db.commit()
# Nilai awal HANYA saat field baru dibuat; sesudahnya nilai yang diubah user di web tidak disentuh.
if _payroll_fields_created:
    for _k, _e in emp.items():
        frappe.db.set_value("Employee", _e, {
            "custom_tunjangan_jabatan": 1500000 if _k == "dewi" else 0,
            "custom_tarif_bpjs_kesehatan": 1, "custom_tarif_bpjs_jht": 2,
            "custom_tarif_bpjs_jp": 1, "custom_tarif_pph21": 0})
    frappe.db.commit()
    log("nilai awal pengaturan gaji diisi")

# 8. Payroll: komponen, struktur gaji, slip gaji Juli-September -------------------------
BANK = {"rani": "1234567801", "budi": "1234567802", "dewi": "1234567803",
        "sari": "1234567804", "agus": "1234567805", "maya": "1234567806"}
BASE = {"rani": 7500000, "budi": 6500000, "dewi": 12000000, "sari": 11000000,
        "agus": 6000000, "maya": 6500000}
STRUCT = "Standard Salary Structure"
COMPONENTS = [  # (nama, abbr, tipe, formula, remove_if_zero)
    ("Basic Salary", "GP", "Earning", "base", 0),
    ("Transport Allowance", "TT", "Earning", "500000", 0),
    ("Meal Allowance", "TM", "Earning", "750000", 0),
    ("Position Allowance", "TJ", "Earning", "custom_tunjangan_jabatan", 1),
    ("BPJS Health", "BPK", "Deduction", "GP * custom_tarif_bpjs_kesehatan / 100", 0),
    ("BPJS JHT", "BJHT", "Deduction", "GP * custom_tarif_bpjs_jht / 100", 0),
    ("BPJS JP", "BJP", "Deduction", "GP * custom_tarif_bpjs_jp / 100", 0),
    ("Income Tax (PPh 21)", "PPH", "Deduction", "(GP + TT + TM + TJ) * custom_tarif_pph21 / 100", 0),
]
try:
    for key, num in BANK.items():
        frappe.db.set_value("Employee", emp[key], {"bank_name": "BCA", "bank_ac_no": num, "salary_mode": "Bank"})
    # Migrasi: struktur lama (komponen "Potongan BPJS" tunggal) dibongkar lalu dibangun ulang.
    if exists("Salary Structure", STRUCT) and any(d.salary_component == "Potongan BPJS" for d in
                                                  frappe.get_doc("Salary Structure", STRUCT).deductions):
        for n in frappe.get_all("Salary Slip", pluck="name"):
            d = frappe.get_doc("Salary Slip", n)
            if d.docstatus == 1:
                d.cancel()
            frappe.delete_doc("Salary Slip", n, force=1)
        for n in frappe.get_all("Salary Structure Assignment", pluck="name"):
            d = frappe.get_doc("Salary Structure Assignment", n)
            if d.docstatus == 1:
                d.cancel()
            frappe.delete_doc("Salary Structure Assignment", n, force=1)
        d = frappe.get_doc("Salary Structure", STRUCT)
        d.cancel()
        frappe.delete_doc("Salary Structure", STRUCT, force=1)
        frappe.delete_doc("Salary Component", "Potongan BPJS", force=1)
        frappe.db.commit()
        log("struktur gaji lama dibongkar")
    OLD_FORMULAS = {  # migrasi satu kali: rumus lama (tarif tetap) -> rumus baru (field Employee)
        "Position Allowance": '1500000 if designation == "Manajer Keuangan" else 0',
        "BPJS Health": "GP * 0.01", "BPJS JHT": "GP * 0.02", "BPJS JP": "GP * 0.01",
        "Income Tax (PPh 21)": "(GP + TT + TM + TJ) * 0.025",
    }
    for n, ab, t, fm, rz in COMPONENTS:
        if not exists("Salary Component", n):
            make(dict(doctype="Salary Component", salary_component=n, salary_component_abbr=ab, type=t,
                      amount_based_on_formula=1, formula=fm, remove_if_zero_valued=rz,
                      depends_on_payment_days=0 if t == "Deduction" else 1))
        elif OLD_FORMULAS.get(n) and frappe.db.get_value("Salary Component", n, "formula") == OLD_FORMULAS[n]:
            frappe.db.set_value("Salary Component", n, "formula", fm)
            log(f"rumus komponen {n} dimigrasi")
        if exists("Salary Structure", STRUCT) and OLD_FORMULAS.get(n):
            # update di tempat (kolom formula allow_on_submit), tanpa bongkar struktur
            for _row in frappe.get_all("Salary Detail", filters={"parent": STRUCT, "salary_component": n,
                                                                   "formula": OLD_FORMULAS[n]}, pluck="name"):
                frappe.db.set_value("Salary Detail", _row, "formula", fm)
                log(f"rumus {n} di {STRUCT} dimigrasi")
    frappe.db.commit()
    if not exists("Salary Structure", STRUCT):
        def rows(tp):
            return [dict(salary_component=n, abbr=ab, amount_based_on_formula=1, formula=fm)
                    for n, ab, t, fm, rz in COMPONENTS if t == tp]
        make(dict(doctype="Salary Structure", name=STRUCT, company=C, currency="IDR",
                  payroll_frequency="Monthly", is_active="Yes",
                  earnings=rows("Earning"), deductions=rows("Deduction")), submit=True)
    for key, e in emp.items():
        if not exists("Salary Structure Assignment", {"employee": e, "docstatus": 1}):
            make(dict(doctype="Salary Structure Assignment", employee=e, salary_structure=STRUCT,
                      from_date=f"{Y}-01-01", company=C, base=BASE[key]), submit=True)
        for m in (7, 8, 9):
            first = f"{Y}-{m:02d}-01"
            if not exists("Salary Slip", {"employee": e, "start_date": first, "docstatus": 1}):
                last = frappe.utils.get_last_day(first).strftime("%Y-%m-%d")
                make(dict(doctype="Salary Slip", employee=e, posting_date=last, start_date=first,
                          end_date=last, salary_structure=STRUCT), submit=True)
    frappe.db.commit()
except Exception as ex:
    frappe.db.rollback()
    log(f"PERINGATAN: payroll dilewati ({ex})")

# Employee Checkin.time berada di permlevel 1. Dulu role Employee diberi izin tulis permlevel 1 agar
# klien bisa mengirim jam; sekarang jam ditentukan server lewat hris_checkin (sadar zona waktu),
# jadi izin itu DICABUT (idempoten). Jam yang dikirim langsung ke /api/resource diabaikan (jam server).
for _n in frappe.get_all("Custom DocPerm", filters={"parent": "Employee Checkin", "role": "Employee", "permlevel": 1},
                         pluck="name"):
    frappe.delete_doc("Custom DocPerm", _n, force=1)
    frappe.clear_cache(doctype="Employee Checkin")
    log("izin tulis permlevel 1 Employee Checkin untuk role Employee dicabut")
if not frappe.db.exists("Custom Field", {"dt": "Employee Checkin", "fieldname": "custom_timezone"}):
    make(dict(doctype="Custom Field", dt="Employee Checkin", fieldname="custom_timezone", label="Timezone Used",
              fieldtype="Data", insert_after="device_id"))
    frappe.clear_cache(doctype="Employee Checkin")
frappe.db.commit()

# Custom Field delegasi cuti. ignore_user_permissions=1 supaya ESS boleh memilih rekan
# yang tidak termasuk User Permission-nya (Employee dirinya sendiri).
# Custom field untuk koreksi absensi (Attendance Request). custom_rejected di permlevel 1
# agar role Employee tidak bisa mengubahnya.
for cf in [
    dict(dt="Attendance Request", fieldname="custom_requested_check_in", label="Requested Check-in",
         fieldtype="Time", insert_after="explanation"),
    dict(dt="Attendance Request", fieldname="custom_requested_check_out", label="Requested Check-out",
         fieldtype="Time", insert_after="custom_requested_check_in"),
    dict(dt="Attendance Request", fieldname="custom_rejected", label="Rejected",
         fieldtype="Check", permlevel=1, insert_after="custom_requested_check_out"),
]:
    if not frappe.db.exists("Custom Field", {"dt": cf["dt"], "fieldname": cf["fieldname"]}):
        make(dict(doctype="Custom Field", **cf))
        frappe.clear_cache(doctype=cf["dt"])

for cf in [
    dict(dt="Employee", fieldname="custom_em2_name", label="Second Emergency Contact: Name", fieldtype="Data",
         insert_after="emergency_phone_number"),
    dict(dt="Employee", fieldname="custom_em2_relation", label="Second Emergency Contact: Relation", fieldtype="Data",
         insert_after="custom_em2_name"),
    dict(dt="Employee", fieldname="custom_em2_phone", label="Second Emergency Contact: Phone", fieldtype="Data",
         insert_after="custom_em2_relation"),
]:
    if not frappe.db.exists("Custom Field", {"dt": cf["dt"], "fieldname": cf["fieldname"]}):
        make(dict(doctype="Custom Field", **cf))
        frappe.clear_cache(doctype=cf["dt"])

for cf in [
    dict(fieldname="custom_delegate", label="Delegate", fieldtype="Link", options="Employee",
         insert_after="leave_approver_name", ignore_user_permissions=1),
    dict(fieldname="custom_delegate_name", label="Delegate Name", fieldtype="Data", read_only=1,
         fetch_from="custom_delegate.employee_name", insert_after="custom_delegate"),
    # Jabatan pemohon, agar approver (MSS) tidak perlu akses baca Employee.
    dict(fieldname="custom_designation", label="Designation", fieldtype="Data", read_only=1,
         fetch_from="employee.designation", insert_after="employee_name"),
]:
    if not frappe.db.exists("Custom Field", {"dt": "Leave Application", "fieldname": cf["fieldname"]}):
        make(dict(doctype="Custom Field", dt="Leave Application", **cf))
        frappe.clear_cache(doctype="Leave Application")

# Isi ulang jabatan untuk pengajuan yang dibuat sebelum custom field ada.
for _n, _e in frappe.get_all("Leave Application", filters={"custom_designation": ["is", "not set"]},
                             fields=["name", "employee"], as_list=True):
    frappe.db.set_value("Leave Application", _n, "custom_designation",
                        frappe.db.get_value("Employee", _e, "designation"), update_modified=False)
frappe.db.commit()

# 5c. Data profil pribadi (hanya diisi bila masih kosong, supaya edit dari aplikasi tidak tertimpa)
PERSONAL = {  # key: (alamat, kontak darurat 1 (nama, hubungan, telp), kontak darurat 2 atau None)
    "rani": ("Jl. Melati No. 12, Jakarta Selatan", ("Siti Aminah", "Mother", "0813-1111-0001"), ("Andi Test", "Sibling", "0813-2222-0001")),
    "budi": ("Jl. Kenanga No. 5, Depok", ("Hartono", "Father", "0813-1111-0002"), None),
    "dewi": ("Jl. Anggrek No. 8, Bekasi", ("Bagus Kusuma", "Spouse", "0813-1111-0003"), ("Ratna Kusuma", "Mother", "0813-2222-0003")),
    "sari": ("Jl. Mawar No. 3, Tangerang", ("Wulan", "Sibling", "0813-1111-0004"), None),
    "agus": ("Jl. Cempaka No. 21, Bogor", ("Pratama Sr", "Father", "0813-1111-0005"), None),
    "maya": ("Jl. Dahlia No. 9, Jakarta Timur", ("Lestari", "Mother", "0813-1111-0006"), None),
}
for i, (key, (addr, em1, em2)) in enumerate(PERSONAL.items(), start=1):
    cur = frappe.db.get_value("Employee", emp[key], ["current_address", "person_to_be_contacted"], as_dict=True)
    if not cur.current_address and not cur.person_to_be_contacted:
        vals = {"current_address": addr, "permanent_address": addr, "personal_email": f"{key}.pribadi@example.com",
                "date_of_birth": f"199{i}-0{i}-1{i}", "marital_status": "Single",
                "person_to_be_contacted": em1[0], "relation": em1[1], "emergency_phone_number": em1[2]}
        if em2:
            vals.update(custom_em2_name=em2[0], custom_em2_relation=em2[1], custom_em2_phone=em2[2])
        frappe.db.set_value("Employee", emp[key], vals)
frappe.db.commit()

for cf in [
    dict(dt="Travel Request", fieldname="custom_destination", label="Destination", fieldtype="Data", insert_after="employee_name"),
    dict(dt="Travel Request", fieldname="custom_from_date", label="From Date", fieldtype="Date", insert_after="custom_destination"),
    dict(dt="Travel Request", fieldname="custom_to_date", label="To Date", fieldtype="Date", insert_after="custom_from_date"),
    dict(dt="Travel Request", fieldname="custom_transport", label="Transport", fieldtype="Data", insert_after="custom_to_date"),
    dict(dt="Travel Request", fieldname="custom_timezone", label="Work Location Timezone", fieldtype="Data",
         default="Asia/Jakarta", description="IANA timezone, e.g. Asia/Jakarta, Asia/Makassar, Asia/Jayapura",
         insert_after="custom_transport"),
    dict(dt="Travel Request", fieldname="custom_rejected", label="Rejected", fieldtype="Check", permlevel=1,
         insert_after="custom_timezone"),
]:
    if not frappe.db.exists("Custom Field", {"dt": cf["dt"], "fieldname": cf["fieldname"]}):
        make(dict(doctype="Custom Field", **cf))
        frappe.clear_cache(doctype=cf["dt"])

# Doctype kustom "Overtime Request" (hrms Overtime Slip berbasis payroll/attendance, tanpa alur pengajuan).
# Dibuat/diakses lewat Server Script (ignore_permissions); role HR mengelola di web.
if not frappe.db.exists("DocType", "Overtime Request"):
    make(dict(
        doctype="DocType", name="Overtime Request", module="HR", custom=1, naming_rule="Expression (old style)",
        autoname="OT-.YYYY.-.#####", track_changes=1,
        fields=[
            dict(fieldname="employee", label="Employee", fieldtype="Link", options="Employee", reqd=1, in_list_view=1),
            dict(fieldname="employee_name", label="Employee Name", fieldtype="Data", fetch_from="employee.employee_name",
                 read_only=1, in_list_view=1),
            dict(fieldname="date", label="Date", fieldtype="Date", reqd=1, in_list_view=1),
            dict(fieldname="is_holiday", label="Holiday / Weekly Off", fieldtype="Check"),
            dict(fieldname="start_time", label="Start Time", fieldtype="Time", reqd=1),
            dict(fieldname="end_time", label="End Time", fieldtype="Time", reqd=1),
            dict(fieldname="hours", label="Hours", fieldtype="Float", in_list_view=1),
            dict(fieldname="note", label="Work Description", fieldtype="Small Text"),
            dict(fieldname="status", label="Status", fieldtype="Select", options="pending\napproved\npaid\nrejected",
                 default="pending", in_list_view=1, in_standard_filter=1),
        ],
        permissions=[dict(role="System Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR User", read=1, write=1, create=1)]))
    frappe.clear_cache()
if frappe.db.get_value("DocType", "Overtime Request", "autoname") != "OT-.YYYY.-.#####":
    frappe.db.set_value("DocType", "Overtime Request", {"autoname": "OT-.YYYY.-.#####",
                                                         "naming_rule": "Expression (old style)"})
    frappe.clear_cache()
    log("penamaan Overtime Request diperbaiki")
frappe.db.commit()

# Permintaan perubahan data pribadi (diajukan karyawan, diputuskan HR). Karyawan tanpa hak langsung.
if not frappe.db.exists("DocType", "Profile Change Request"):
    make(dict(
        doctype="DocType", name="Profile Change Request", module="HR", custom=1, naming_rule="Expression (old style)",
        autoname="PCR-.YYYY.-.#####", track_changes=1,
        fields=[
            dict(fieldname="employee", label="Employee", fieldtype="Link", options="Employee", reqd=1, in_list_view=1),
            dict(fieldname="employee_name", label="Employee Name", fieldtype="Data", fetch_from="employee.employee_name",
                 read_only=1, in_list_view=1),
            dict(fieldname="status", label="Status", fieldtype="Select", options="Pending\nApproved\nRejected",
                 default="Pending", in_list_view=1, in_standard_filter=1),
            dict(fieldname="reason", label="Reason", fieldtype="Small Text", reqd=1),
            dict(fieldname="proposed", label="Proposed Values (JSON)", fieldtype="Long Text", read_only=1),
            dict(fieldname="changes", label="Changes (JSON)", fieldtype="Long Text", read_only=1),
            dict(fieldname="hr_note", label="HR Note", fieldtype="Small Text"),
            dict(fieldname="decided_by", label="Decided By", fieldtype="Link", options="User", read_only=1),
            dict(fieldname="decided_on", label="Decided On", fieldtype="Datetime", read_only=1),
        ],
        permissions=[dict(role="System Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR User", read=1, write=1, create=1)]))
    frappe.clear_cache()
frappe.db.commit()

# Sidebar modul Leaves (v16): tautan ke Overtime Request dan Travel Request lewat lapisan
# kustom situs (Custom Sidebar), cara resmi menambah item tanpa mengubah sidebar bawaan hrms.
# Workspace "HR Requests" percobaan lama dihapus.
for _dt in ("Workspace", "Workspace Sidebar"):
    if frappe.db.exists(_dt, "HR Requests"):
        frappe.delete_doc(_dt, "HR Requests", ignore_permissions=True, force=True)
        log(f"{_dt} HR Requests dihapus")
if frappe.db.exists("Sidebar", "Leaves"):
    from frappe.desk.doctype.custom_sidebar.custom_sidebar import add_site_sidebar_item
    for _dt, _ic in (("Overtime Request", "clock"), ("Travel Request", "briefcase"), ("Profile Change Request", "user")):
        add_site_sidebar_item("Leaves", dict(label=_dt, type="Link", link_type="DocType", link_to=_dt,
                                             icon=_ic, collapsible=1))
    log("sidebar Leaves: tautan Overtime Request dan Travel Request")
    # Urutan: tepat di bawah Leave Application (secara bawaan item tambahan jatuh di paling bawah).
    from frappe.desk.doctype.custom_sidebar.custom_sidebar import _save_customization, layer_arrangement
    _arr = layer_arrangement("Leaves", None)
    _mine = [r for r in _arr if r.get("link_to") in ("Overtime Request", "Travel Request", "Profile Change Request")]
    _rest = [r for r in _arr if r not in _mine]
    _at = next((n for n, r in enumerate(_rest) if r.get("link_to") == "Leave Application"), 0) + 1
    _mine.sort(key=lambda r: ["Overtime Request", "Travel Request", "Profile Change Request"].index(r["link_to"]))
    _save_customization("Leaves", _rest[:_at] + _mine + _rest[_at:], None)
    log("sidebar Leaves: diurutkan di bawah Leave Application")
frappe.db.commit()
frappe.clear_cache()

# Dokumen digital karyawan. Role Employee: hanya baca/ubah dokumen miliknya sendiri (if_owner), tanpa hak
# membuat langsung (dibuat lewat hris_create_my_document). status/verified_by di permlevel 1 (HR saja).
if not frappe.db.exists("DocType", "Employee Document"):
    make(dict(
        doctype="DocType", name="Employee Document", module="HR", custom=1, naming_rule="Expression (old style)",
        autoname="EMPDOC-.YYYY.-.#####", track_changes=1,
        fields=[
            dict(fieldname="employee", label="Employee", fieldtype="Link", options="Employee", reqd=1, in_list_view=1),
            dict(fieldname="employee_name", label="Employee Name", fieldtype="Data", fetch_from="employee.employee_name",
                 read_only=1, in_list_view=1),
            dict(fieldname="document_name", label="Document Name", fieldtype="Data", reqd=1, in_list_view=1),
            dict(fieldname="category", label="Category", fieldtype="Select", options="Contract\nDecree\nCertificate\nIdentity",
                 reqd=1, in_list_view=1, in_standard_filter=1),
            dict(fieldname="file", label="File", fieldtype="Attach"),
            dict(fieldname="expires_on", label="Expires On", fieldtype="Date"),
            dict(fieldname="status", label="Status", fieldtype="Select", options="Pending\nVerified\nRejected",
                 default="Pending", permlevel=1, in_list_view=1, in_standard_filter=1),
            dict(fieldname="verified_by", label="Verified By", fieldtype="Link", options="User", permlevel=1, read_only=1),
        ],
        permissions=[
            dict(role="System Manager", read=1, write=1, create=1, delete=1),
            dict(role="HR Manager", read=1, write=1, create=1, delete=1),
            dict(role="HR User", read=1, write=1, create=1),
            dict(role="System Manager", permlevel=1, read=1, write=1),
            dict(role="HR Manager", permlevel=1, read=1, write=1),
            dict(role="HR User", permlevel=1, read=1, write=1),
            dict(role="Employee", read=1, write=1, if_owner=1),
        ]))
    frappe.clear_cache()
if not frappe.db.exists("Custom Field", {"dt": "Employee Document", "fieldname": "rejection_reason"}):
    make(dict(doctype="Custom Field", dt="Employee Document", fieldname="rejection_reason", label="Rejection Reason",
              fieldtype="Small Text", permlevel=1, insert_after="verified_by"))
    frappe.clear_cache(doctype="Employee Document")
if not frappe.db.exists("Custom Field", {"dt": "Employee Document", "fieldname": "change_reason"}):
    make(dict(doctype="Custom Field", dt="Employee Document", fieldname="change_reason", label="Change Reason",
              fieldtype="Small Text", permlevel=1, insert_after="rejection_reason"))
    frappe.clear_cache(doctype="Employee Document")
_dd = frappe.get_doc("DocType", "Employee Document")
_stf = [f for f in _dd.fields if f.fieldname == "status"][0]
if "Change Requested" not in (_stf.options or ""):
    _stf.options = "Pending\nVerified\nRejected\nChange Requested"
    _dd.save()
    frappe.clear_cache(doctype="Employee Document")
    log("status Change Requested ditambahkan ke Employee Document")
# Batas unggah: 5 MB dan hanya PDF/JPG/PNG (berlaku global untuk unggahan di site ini).
if frappe.db.get_single_value("System Settings", "max_file_size") != 5:
    frappe.db.set_single_value("System Settings", "max_file_size", 5)
if not frappe.db.get_single_value("System Settings", "allowed_file_extensions"):
    frappe.db.set_single_value("System Settings", "allowed_file_extensions", "PDF\nJPG\nJPEG\nPNG")
frappe.db.commit()

# Izin lampiran bukti: Employee boleh baca/ubah dokumen Overtime Request / Travel Request miliknya
# sendiri (if_owner) supaya upload_file berjalan; HR mengelola penuh. Atasan dapat akses baca via DocShare.
from frappe.permissions import add_permission, update_permission_property
for _dt, _roles in (("Overtime Request", ("Employee",)), ("Travel Request", ("Employee", "HR User", "HR Manager"))):
    for _role in _roles:
        _has = frappe.db.exists("Custom DocPerm", {"parent": _dt, "role": _role, "permlevel": 0}) or \
            any(p.role == _role and p.permlevel == 0 for p in frappe.get_meta(_dt).permissions)
        if not _has:
            add_permission(_dt, _role, 0)
            update_permission_property(_dt, _role, 0, "read", 1)
            update_permission_property(_dt, _role, 0, "write", 1)
            if _role == "Employee":
                update_permission_property(_dt, _role, 0, "if_owner", 1)
            else:
                update_permission_property(_dt, _role, 0, "create", 1)
                update_permission_property(_dt, _role, 0, "submit", 1)
            frappe.clear_cache(doctype=_dt)
            log(f"izin {_role} pada {_dt} ditambahkan")
frappe.db.commit()

# Push notification (Expo). Push Token: dikelola lewat Server Script; Push Settings: saklar dry run.
if not frappe.db.exists("DocType", "Push Token"):
    make(dict(
        doctype="DocType", name="Push Token", module="HR", custom=1, naming_rule="By fieldname", autoname="field:token",
        fields=[
            dict(fieldname="user", label="User", fieldtype="Link", options="User", reqd=1, in_list_view=1),
            dict(fieldname="token", label="Token", fieldtype="Data", reqd=1, unique=1, in_list_view=1),
            dict(fieldname="platform", label="Platform", fieldtype="Data"),
            dict(fieldname="device_name", label="Device Name", fieldtype="Data"),
            dict(fieldname="last_seen", label="Last Seen", fieldtype="Datetime"),
        ],
        permissions=[dict(role="System Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR Manager", read=1, write=1, create=1, delete=1)]))
    frappe.clear_cache()
if not frappe.db.exists("DocType", "Push Settings"):
    make(dict(
        doctype="DocType", name="Push Settings", module="HR", custom=1, issingle=1,
        fields=[dict(fieldname="dry_run", label="Dry Run (log payload instead of sending)", fieldtype="Check", default="1")],
        permissions=[dict(role="System Manager", read=1, write=1), dict(role="HR Manager", read=1, write=1)]))
    frappe.clear_cache()
    frappe.db.set_single_value("Push Settings", "dry_run", 1)  # nilai awal dev; ubah di web untuk kirim sungguhan
frappe.db.commit()

# Bukti koreksi absensi: batasi role Employee pada Attendance Request ke dokumen miliknya (if_owner).
if not any(p.role == "Employee" and p.permlevel == 0 and p.if_owner for p in frappe.get_meta("Attendance Request").permissions):
    update_permission_property("Attendance Request", "Employee", 0, "if_owner", 1)
    frappe.clear_cache(doctype="Attendance Request")
    log("Attendance Request: izin Employee dibatasi if_owner")
frappe.db.commit()

# Kontak darurat tambahan (child table) di Employee. Kontak utama tetap di field bawaan Employee.
if not frappe.db.exists("DocType", "Employee Emergency Contact"):
    make(dict(
        doctype="DocType", name="Employee Emergency Contact", module="HR", custom=1, istable=1, editable_grid=1,
        fields=[
            dict(fieldname="contact_name", label="Contact Name", fieldtype="Data", reqd=1, in_list_view=1),
            dict(fieldname="relation", label="Relation", fieldtype="Select",
                 options="\nMother\nFather\nSibling\nSpouse\nFriend\nOther", in_list_view=1),
            dict(fieldname="phone", label="Phone", fieldtype="Data", reqd=1, in_list_view=1),
        ]))
    frappe.clear_cache()
if not frappe.db.exists("Custom Field", {"dt": "Employee", "fieldname": "custom_emergency_contacts"}):
    make(dict(doctype="Custom Field", dt="Employee", fieldname="custom_emergency_contacts",
              label="Additional Emergency Contacts", fieldtype="Table", options="Employee Emergency Contact",
              insert_after="custom_em2_phone"))
    frappe.clear_cache(doctype="Employee")
frappe.db.commit()
# Migrasi satu kali: custom_em2_* -> baris tabel (hanya bila tabel karyawan itu masih kosong). Field lama dibiarkan.
for _e in frappe.get_all("Employee", filters={"custom_em2_name": ["is", "set"]},
                         fields=["name", "custom_em2_name", "custom_em2_relation", "custom_em2_phone"]):
    if not frappe.db.exists("Employee Emergency Contact", {"parent": _e.name, "parenttype": "Employee"}):
        _rel = _e.custom_em2_relation if _e.custom_em2_relation in ("Mother", "Father", "Sibling", "Spouse", "Friend") \
            else ("Other" if _e.custom_em2_relation else None)
        frappe.get_doc(dict(doctype="Employee Emergency Contact", parent=_e.name, parenttype="Employee",
                            parentfield="custom_emergency_contacts", idx=1, contact_name=_e.custom_em2_name,
                            relation=_rel, phone=_e.custom_em2_phone or "-")).db_insert()
        log(f"kontak darurat kedua {_e.name} dimigrasi ke tabel")
frappe.db.commit()

# Anggota keluarga karyawan (child table), dipakai untuk bagian Keluarga dan perhitungan PTKP.
if not frappe.db.exists("DocType", "Employee Family Member"):
    make(dict(
        doctype="DocType", name="Employee Family Member", module="HR", custom=1, istable=1, editable_grid=1,
        fields=[
            dict(fieldname="member_name", label="Member Name", fieldtype="Data", reqd=1, in_list_view=1),
            dict(fieldname="relation", label="Relation", fieldtype="Select",
                 options="Spouse\nChild\nFather\nMother\nSibling\nOther", in_list_view=1),
            dict(fieldname="date_of_birth", label="Date of Birth", fieldtype="Date", in_list_view=1),
            dict(fieldname="is_dependent", label="Is Dependent (PTKP)", fieldtype="Check", in_list_view=1),
        ]))
    frappe.clear_cache()
if not frappe.db.exists("Custom Field", {"dt": "Employee", "fieldname": "custom_family_members"}):
    make(dict(doctype="Custom Field", dt="Employee", fieldname="custom_family_members", label="Family Members",
              fieldtype="Table", options="Employee Family Member", insert_after="custom_emergency_contacts"))
    frappe.clear_cache(doctype="Employee")
frappe.db.commit()

# ---- Pajak PPh 21 (PMK 168/2023): status PTKP, kategori TER, tabel TER ----
for cf in [
    dict(fieldname="custom_ptkp_status", label="PTKP Status (auto)", fieldtype="Data", read_only=1, permlevel=1,
         insert_after="custom_tarif_pph21"),
    dict(fieldname="custom_ter_category", label="TER Category (auto)", fieldtype="Data", read_only=1, permlevel=1,
         insert_after="custom_ptkp_status"),
]:
    if not frappe.db.exists("Custom Field", {"dt": "Employee", "fieldname": cf["fieldname"]}):
        make(dict(doctype="Custom Field", dt="Employee", **cf))
        frappe.clear_cache(doctype="Employee")
# Migrasi: tarif PPh 21 manual bawaan 2.5 diganti 0 (0 = hitung otomatis dari TER); sekali saja.
_cfp = frappe.db.get_value("Custom Field", {"dt": "Employee", "fieldname": "custom_tarif_pph21"}, ["name", "default"], as_dict=True)
if _cfp and _cfp.default == "2.5":
    frappe.db.set_value("Custom Field", _cfp.name, {"default": "0",
        "description": "Manual rate. Leave 0 to calculate PPh 21 automatically from the TER table."})
    frappe.db.sql("update `tabEmployee` set custom_tarif_pph21=0 where custom_tarif_pph21=2.5")
    frappe.clear_cache(doctype="Employee")
    log("tarif PPh 21 manual 2.5 direset ke 0 (otomatis TER)")
if not frappe.db.exists("DocType", "PPh21 TER Rate"):
    make(dict(
        doctype="DocType", name="PPh21 TER Rate", module="HR", custom=1, naming_rule="Random", autoname="hash",
        fields=[
            dict(fieldname="category", label="TER Category", fieldtype="Select", options="A\nB\nC", reqd=1, in_list_view=1),
            dict(fieldname="bruto_from", label="Gross From (IDR)", fieldtype="Currency", reqd=1, in_list_view=1),
            dict(fieldname="bruto_to", label="Gross To (IDR, 0 = no limit)", fieldtype="Currency", in_list_view=1),
            dict(fieldname="rate", label="Rate (%)", fieldtype="Float", reqd=1, in_list_view=1),
        ],
        permissions=[dict(role="System Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR User", read=1)]))
    frappe.clear_cache()
# Tabel TER (PMK 168/2023 Lampiran, tarif bulanan atas penghasilan bruto). Format: (batas atas, tarif %), None = tanpa batas.
TER_TABLES = {
    "A": [(5400000, 0), (5650000, 0.25), (5950000, 0.5), (6300000, 0.75), (6750000, 1), (7500000, 1.25), (8550000, 1.5),
          (9650000, 1.75), (10050000, 2), (10350000, 2.25), (10700000, 2.5), (11050000, 3), (11600000, 3.5), (12500000, 4),
          (13750000, 5), (15100000, 6), (16950000, 7), (19750000, 8), (24150000, 9), (26450000, 10), (28000000, 11),
          (30050000, 12), (32400000, 13), (35400000, 14), (39100000, 15), (43850000, 16), (47800000, 17), (51400000, 18),
          (56300000, 19), (62200000, 20), (68600000, 21), (77500000, 22), (89000000, 23), (103000000, 24), (125000000, 25),
          (157000000, 26), (206000000, 27), (337000000, 28), (454000000, 29), (550000000, 30), (695000000, 31),
          (910000000, 32), (1400000000, 33), (None, 34)],
    "B": [(6200000, 0), (6500000, 0.25), (6850000, 0.5), (7300000, 0.75), (9200000, 1), (10750000, 1.5), (11250000, 2),
          (11600000, 2.5), (12600000, 3), (13600000, 4), (14950000, 5), (16400000, 6), (18450000, 7), (21850000, 8),
          (26000000, 9), (27700000, 10), (29350000, 11), (31450000, 12), (33950000, 13), (37100000, 14), (41100000, 15),
          (45800000, 16), (49500000, 17), (53800000, 18), (58500000, 19), (64000000, 20), (71000000, 21), (80000000, 22),
          (93000000, 23), (109000000, 24), (129000000, 25), (163000000, 26), (211000000, 27), (374000000, 28),
          (459000000, 29), (555000000, 30), (704000000, 31), (957000000, 32), (1405000000, 33), (None, 34)],
    "C": [(6600000, 0), (6950000, 0.25), (7350000, 0.5), (7800000, 0.75), (8850000, 1), (9800000, 1.25), (10950000, 1.5),
          (11200000, 1.75), (12050000, 2), (12950000, 3), (14150000, 4), (15550000, 5), (17050000, 6), (19500000, 7),
          (22700000, 8), (26600000, 9), (28100000, 10), (30100000, 11), (32600000, 12), (35400000, 13), (38900000, 14),
          (43000000, 15), (47400000, 16), (51200000, 17), (55800000, 18), (60400000, 19), (66700000, 20), (74500000, 21),
          (83200000, 22), (95600000, 23), (110000000, 24), (134000000, 25), (169000000, 26), (221000000, 27),
          (390000000, 28), (463000000, 29), (561000000, 30), (709000000, 31), (965000000, 32), (1419000000, 33), (None, 34)],
}
if frappe.db.count("PPh21 TER Rate") == 0:
    for _cat, _rows in TER_TABLES.items():
        _lo = 0
        for _hi, _rt in _rows:
            frappe.get_doc(dict(doctype="PPh21 TER Rate", category=_cat, bruto_from=_lo, bruto_to=_hi or 0,
                                rate=_rt)).insert(ignore_permissions=True)
            _lo = (_hi + 1) if _hi else 0
    log("tabel TER PPh 21 diisi")
frappe.db.commit()
# Hitung status PTKP / kategori TER untuk semua Employee (idempoten; selanjutnya otomatis lewat Server Script).
for _e in frappe.get_all("Employee", fields=["name", "marital_status", "custom_ptkp_status"]):
    _deps = frappe.db.sql("select count(*) from `tabEmployee Family Member` where parent=%s and parenttype='Employee' "
                          "and is_dependent=1 and relation!='Spouse'", _e.name)[0][0]
    _deps = min(_deps, 3)
    _st = ("K/" if _e.marital_status == "Married" else "TK/") + str(_deps)
    _cat = "A" if _st in ("TK/0", "TK/1", "K/0") else ("B" if _st in ("TK/2", "TK/3", "K/1", "K/2") else "C")
    frappe.db.set_value("Employee", _e.name, {"custom_ptkp_status": _st, "custom_ter_category": _cat}, update_modified=False)
frappe.db.commit()

# ---- HR Announcement ----
if not frappe.db.exists("DocType", "HR Announcement"):
    make(dict(
        doctype="DocType", name="HR Announcement", module="HR", custom=1, naming_rule="Expression (old style)",
        autoname="HR-ANN-.YYYY.-.#####", track_changes=1,
        fields=[
            dict(fieldname="title", label="Title", fieldtype="Data", reqd=1, in_list_view=1),
            dict(fieldname="priority", label="Priority", fieldtype="Select", options="Normal\nImportant", default="Normal",
                 in_list_view=1, in_standard_filter=1),
            dict(fieldname="audience", label="Audience", fieldtype="Select", options="All Employees\nDepartment",
                 default="All Employees", in_list_view=1),
            dict(fieldname="department", label="Department", fieldtype="Link", options="Department",
                 depends_on="eval:doc.audience=='Department'", mandatory_depends_on="eval:doc.audience=='Department'"),
            dict(fieldname="published", label="Published", fieldtype="Check", in_list_view=1, in_standard_filter=1),
            dict(fieldname="published_on", label="Published On", fieldtype="Datetime", read_only=1),
            dict(fieldname="expires_on", label="Expires On", fieldtype="Date"),
            dict(fieldname="content", label="Content", fieldtype="Text Editor"),
            dict(fieldname="attachment", label="Attachment", fieldtype="Attach"),
        ],
        permissions=[dict(role="System Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR Manager", read=1, write=1, create=1, delete=1),
                     dict(role="HR User", read=1, write=1, create=1, delete=1),
                     dict(role="Employee", read=1)]))
    frappe.clear_cache()
frappe.db.commit()
# Sidebar "Shift and Attendance": HR Announcement tepat di bawah Dashboard.
if frappe.db.exists("Sidebar", "Shift & Attendance"):
    from frappe.desk.doctype.custom_sidebar.custom_sidebar import add_site_sidebar_item, _save_customization, layer_arrangement
    add_site_sidebar_item("Shift and Attendance", dict(label="HR Announcement", type="Link", link_type="DocType",
                                                      link_to="HR Announcement", icon="bell", collapsible=1))
    _arr = layer_arrangement("Shift and Attendance", None)
    _mine = [r for r in _arr if r.get("link_to") == "HR Announcement"]
    _rest = [r for r in _arr if r not in _mine]
    _at = next((n for n, r in enumerate(_rest) if r.get("label") == "Dashboard"), 0) + 1
    _save_customization("Shift and Attendance", _rest[:_at] + _mine + _rest[_at:], None)
    frappe.db.commit()
    log("sidebar Shift & Attendance: HR Announcement di bawah Dashboard")
    frappe.clear_cache()

# ---- Check-in offline tahan kecurangan ----
if not frappe.db.exists("DocType", "Attendance Offline Settings"):
    make(dict(
        doctype="DocType", name="Attendance Offline Settings", module="HR", custom=1, issingle=1,
        fields=[
            dict(fieldname="max_age_hours", label="Max Queue Age (hours)", fieldtype="Int", default="24"),
            dict(fieldname="skew_tolerance_seconds", label="Clock Skew Tolerance (seconds)", fieldtype="Int", default="300"),
            dict(fieldname="max_per_month", label="Max Offline Check-ins per Month", fieldtype="Int", default="5"),
            dict(fieldname="future_tolerance_seconds", label="Future Tolerance (seconds)", fieldtype="Int", default="120"),
            dict(fieldname="max_anchor_age_hours", label="Max Hours Since Last Server Contact", fieldtype="Int", default="72"),
        ],
        permissions=[dict(role="System Manager", read=1, write=1), dict(role="HR Manager", read=1, write=1)]))
    frappe.clear_cache()
    for _f, _v in (("max_age_hours", 24), ("skew_tolerance_seconds", 300), ("max_per_month", 5),
                   ("future_tolerance_seconds", 120), ("max_anchor_age_hours", 72)):
        frappe.db.set_single_value("Attendance Offline Settings", _f, _v)
for cf in [
    dict(fieldname="custom_offline", label="Offline Check-in", fieldtype="Check", permlevel=1, read_only=1,
         insert_after="custom_timezone"),
    dict(fieldname="custom_client_id", label="Client ID", fieldtype="Data", permlevel=1, read_only=1, unique=0,
         insert_after="custom_offline"),
    dict(fieldname="custom_clock_skew_seconds", label="Clock Skew (seconds)", fieldtype="Int", permlevel=1, read_only=1,
         insert_after="custom_client_id"),
    dict(fieldname="custom_queue_age_seconds", label="Queue Age (seconds)", fieldtype="Int", permlevel=1, read_only=1,
         insert_after="custom_clock_skew_seconds"),
    dict(fieldname="custom_claimed_time", label="Claimed Time", fieldtype="Datetime", permlevel=1,
         insert_after="custom_queue_age_seconds"),
    dict(fieldname="custom_review_status", label="Review Status", fieldtype="Select",
         options="None\nNeeds Review\nApproved\nRejected", default="None", permlevel=1, in_standard_filter=1,
         insert_after="custom_claimed_time"),
    dict(fieldname="custom_flags", label="Flags", fieldtype="Small Text", permlevel=1, read_only=1,
         insert_after="custom_review_status"),
    dict(fieldname="custom_reviewed_by", label="Reviewed By", fieldtype="Link", options="User", permlevel=1, read_only=1,
         insert_after="custom_flags"),
    dict(fieldname="custom_reviewed_on", label="Reviewed On", fieldtype="Datetime", permlevel=1, read_only=1,
         insert_after="custom_reviewed_by"),
]:
    if not frappe.db.exists("Custom Field", {"dt": "Employee Checkin", "fieldname": cf["fieldname"]}):
        make(dict(doctype="Custom Field", dt="Employee Checkin", **cf))
        frappe.clear_cache(doctype="Employee Checkin")
frappe.db.commit()
# Sidebar: "Offline Check-in Review" di bawah "Employee Checkin" (Shift and Attendance).
if frappe.db.exists("Sidebar", "Shift & Attendance"):
    from frappe.desk.doctype.custom_sidebar.custom_sidebar import add_site_sidebar_item, _save_customization, layer_arrangement
    add_site_sidebar_item("Shift and Attendance", dict(label="Offline Check-in Review", type="Link", link_type="DocType",
                                                        link_to="Employee Checkin", icon="clock", collapsible=1,
                                                        route_options='{"custom_review_status": "Needs Review"}'))
    _arr = layer_arrangement("Shift and Attendance", None)
    _mine = [r for r in _arr if r.get("label") == "Offline Check-in Review"]
    _rest = [r for r in _arr if r not in _mine]
    _at = next((n for n, r in enumerate(_rest) if r.get("link_to") == "Employee Checkin" and r.get("label") == "Employee Checkin"), 0) + 1
    _save_customization("Shift and Attendance", _rest[:_at] + _mine + _rest[_at:], None)
    frappe.db.commit()
    log("sidebar: Offline Check-in Review di bawah Employee Checkin")
    frappe.clear_cache()

# Sinkronkan label Custom Field yang sudah ada ke bahasa Inggris (nama field tidak berubah).
for (_dt, _fn), _label in {
    ("Employee", "custom_pengaturan_gaji"): "Salary Settings",
    ("Employee", "custom_tunjangan_jabatan"): "Position Allowance (IDR)",
    ("Employee", "custom_tarif_bpjs_kesehatan"): "BPJS Health Rate (%)",
    ("Employee", "custom_tarif_bpjs_jht"): "BPJS JHT Rate (%)",
    ("Employee", "custom_tarif_bpjs_jp"): "BPJS JP Rate (%)",
    ("Employee", "custom_tarif_pph21"): "Income Tax (PPh 21) Rate (%)",
    ("Employee", "custom_em2_name"): "Second Emergency Contact: Name",
    ("Employee", "custom_em2_relation"): "Second Emergency Contact: Relation",
    ("Employee", "custom_em2_phone"): "Second Emergency Contact: Phone",
    ("Employee", "custom_emergency_contacts"): "Additional Emergency Contacts",
    ("Employee", "custom_family_members"): "Family Members",
    ("Attendance Request", "custom_requested_check_in"): "Requested Check-in",
    ("Attendance Request", "custom_requested_check_out"): "Requested Check-out",
}.items():
    _cf = frappe.db.get_value("Custom Field", {"dt": _dt, "fieldname": _fn}, ["name", "label"], as_dict=True)
    if _cf and _cf.label != _label:
        frappe.db.set_value("Custom Field", _cf.name, "label", _label)
frappe.db.commit()
frappe.clear_cache()

# Bahasa Indonesia tersedia sebagai pilihan (My Settings -> Language). Default sistem dan bahasa
# user TIDAK diubah; tiap user memilih sendiri. Terjemahan khusus kita lewat doctype Translation.
if frappe.db.exists("Language", "id") and not frappe.db.get_value("Language", "id", "enabled"):
    frappe.db.set_value("Language", "id", "enabled", 1)
    log("bahasa id diaktifkan")
TRANSLATIONS_ID = {
    # label Custom Field
    "Salary Settings": "Pengaturan Gaji", "Profile Change Request": "Permintaan Perubahan Profil",
    "Family Members": "Anggota Keluarga", "Member Name": "Nama Anggota", "Is Dependent (PTKP)": "Tanggungan (PTKP)",
    "Spouse": "Pasangan", "Child": "Anak", "Father": "Ayah", "Mother": "Ibu", "Sibling": "Saudara", "Other": "Lainnya",
    "Position Allowance (IDR)": "Tunjangan Jabatan (Rp)",
    "BPJS Health Rate (%)": "Tarif BPJS Kesehatan (%)",
    "BPJS JHT Rate (%)": "Tarif BPJS JHT (%)",
    "BPJS JP Rate (%)": "Tarif BPJS JP (%)",
    "Income Tax (PPh 21) Rate (%)": "Tarif PPh 21 (%)",
    "Second Emergency Contact: Name": "Kontak Darurat Kedua: Nama",
    "Second Emergency Contact: Relation": "Kontak Darurat Kedua: Hubungan",
    "Second Emergency Contact: Phone": "Kontak Darurat Kedua: Telepon",
    "Requested Check-in": "Jam Masuk yang Diminta",
    "Requested Check-out": "Jam Keluar yang Diminta",
    # "Leave" = cuti/izin (terjemahan bawaan Frappe memakai arti "daun")
    "Leave": "Cuti", "Leaves": "Cuti", "Leave Application": "Pengajuan Cuti",
    "Leave Type": "Jenis Cuti", "Leave Allocation": "Alokasi Cuti", "Leave Balance": "Saldo Cuti",
    "Leave Policy": "Kebijakan Cuti", "Leave Policy Assignment": "Penetapan Kebijakan Cuti",
    "Leave Approver": "Penyetuju Cuti", "Leave Period": "Periode Cuti", "Leave Block List": "Daftar Blokir Cuti",
    "Leave Ledger Entry": "Buku Besar Cuti", "Leave Encashment": "Pencairan Cuti",
    "Leave Without Pay": "Cuti Tanpa Gaji", "Leaves Allocated": "Cuti Dialokasikan",
    "Leaves Taken": "Cuti Terpakai", "Leave Balance Report": "Laporan Saldo Cuti",
    "Compensatory Leave Request": "Pengajuan Cuti Pengganti", "Leave and Holiday": "Cuti dan Hari Libur",
    "Travel Request": "Pengajuan Dinas Luar", "Overtime Request": "Pengajuan Lembur",
    "Rejected": "Ditolak",
    "Delegate": "Delegasi",
    "Delegate Name": "Nama Delegasi",
    "Designation": "Jabatan",
    # nama master data (efektif di tampilan Link bila doctype ditandai translated_doctype)
    "Annual Leave": "Cuti Tahunan", "Sick Leave": "Cuti Sakit",
    "Finance Staff": "Staf Keuangan", "Finance Manager": "Manajer Keuangan", "HR Staff": "Staf HR",
    "Morning Shift": "Shift Pagi",
    "Basic Salary": "Gaji Pokok", "Transport Allowance": "Tunjangan Transport",
    "Meal Allowance": "Tunjangan Makan", "Position Allowance": "Tunjangan Jabatan",
    "BPJS Health": "BPJS Kesehatan", "Income Tax (PPh 21)": "PPh 21",
    f"Finance - {ABBR}": f"Keuangan - {ABBR}", f"People Operations - {ABBR}": f"People Ops - {ABBR}",
}
for _src, _tr in TRANSLATIONS_ID.items():
    if not frappe.db.exists("Translation", {"language": "id", "source_text": _src}):
        make(dict(doctype="Translation", language="id", source_text=_src, translated_text=_tr))
for _dt in ("Leave Type", "Designation", "Salary Component", "Shift Type", "Department"):
    if not frappe.db.exists("Property Setter", {"doc_type": _dt, "property": "translated_doctype"}):
        frappe.make_property_setter({"doctype": _dt, "doctype_or_field": "DocType",
                                     "property": "translated_doctype", "value": "1", "property_type": "Check"})
        log(f"translated_doctype diaktifkan untuk {_dt}")
frappe.db.commit()
frappe.clear_cache()

EVENT_SCRIPTS = {  # script berbasis event dokumen: nama_file -> (DocType, event)
    "hris_notify_leave_created": ("Leave Application", "After Insert"),
    "hris_notify_leave_decided": ("Leave Application", "After Save"),
    "hris_notify_payslip": ("Salary Slip", "After Submit"),
    "hris_notify_attendance_correction": ("Attendance Request", "After Submit"),
    "hris_notify_document_status": ("Employee Document", "After Save"),
    "hris_guard_document_upload": ("File", "Before Insert"),
    "hris_employee_tax_status": ("Employee", "Before Save"),
    "hris_salary_slip_pph21": ("Salary Slip", "Before Save"),
    "hris_announcement_publish": ("HR Announcement", "Before Save"),
    "hris_notify_announcement": ("HR Announcement", "After Save"),
    "hris_push_on_notification": ("Notification Log", "After Insert"),
}

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
            if _ln.strip().startswith("# @include: "):
                _ind = _ln[:len(_ln) - len(_ln.lstrip())]
                _snip = open(os.path.join(SS_DIR, _ln.strip()[len("# @include: "):].strip()), encoding="utf-8").read().rstrip("\n")
                _out.extend([(_ind + _l if _l.strip() else _l) for _l in _snip.split("\n")])
            else:
                _out.append(_ln)
        code = "\n".join(_out)
        vals = dict(script_type="API", api_method=name, allow_guest=0, disabled=0, script=code)
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

ensure_roles()

# 9a. Dokumen contoh untuk rani (file kecil sungguhan, private)
_r = emp["rani"]
for _name, _cat, _exp, _st, _fn in [
    ("Employment Contract", "Contract", None, "Verified", "employment-contract.pdf"),
    ("Master's Degree Certificate", "Certificate", None, "Pending", "degree-certificate.pdf"),
    ("National ID Card (KTP)", "Identity", frappe.utils.add_days(nowdate(), 30), "Verified", "national-id.png"),
]:
    if not exists("Employee Document", {"employee": _r, "document_name": _name}):
        _d = make(dict(doctype="Employee Document", employee=_r, document_name=_name, category=_cat, expires_on=_exp))
        if _fn.endswith(".pdf"):
            _objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                     b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>"]
            _body = b"%PDF-1.4\n% " + _name.encode() + b"\n"
            _offs = []
            for _i, _o in enumerate(_objs, start=1):
                _offs.append(len(_body))
                _body += f"{_i} 0 obj\n".encode() + _o + b"\nendobj\n"
            _xref = len(_body)
            _body += f"xref\n0 {len(_objs) + 1}\n".encode() + b"0000000000 65535 f \n"
            for _of in _offs:
                _body += f"{_of:010d} 00000 n \n".encode()
            _body += f"trailer\n<< /Size {len(_objs) + 1} /Root 1 0 R >>\nstartxref\n{_xref}\n%%EOF\n".encode()
        else:
            _body = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5d0000000049454e44ae426082")
        _f = frappe.get_doc(dict(doctype="File", file_name=_fn, content=_body, is_private=1,
                                 attached_to_doctype="Employee Document", attached_to_name=_d.name,
                                 attached_to_field="file")).insert(ignore_permissions=True)
        frappe.db.set_value("Employee Document", _d.name, {"file": _f.file_url, "status": _st,
                                                            "verified_by": "hr.test@example.com" if _st == "Verified" else None})
frappe.db.commit()

# 9c. Appraisal contoh untuk rani (siklus, KRA, goal, appraisal, feedback dari atasan dan HR)
try:
    CYCLE = f"FY {Y} Annual Appraisal"
    for _t in ("Delivery Quality", "Teamwork", "Initiative"):
        if not exists("KRA", _t):
            make(dict(doctype="KRA", title=_t))
    for _c in ("Communication", "Work Quality", "Initiative"):
        if not exists("Employee Feedback Criteria", _c):
            make(dict(doctype="Employee Feedback Criteria", criteria=_c))
    if not exists("Appraisal Cycle", CYCLE):
        make(dict(doctype="Appraisal Cycle", cycle_name=CYCLE, company=C, status="In Progress",
                  start_date=f"{Y}-01-01", end_date=f"{Y}-12-31",
                  kra_evaluation_method="Automated Based on Goal Progress",
                  appraisees=[dict(employee=emp["rani"])]))
    for _g, _kra, _prog, _desc in [
        ("Close monthly books within 5 working days", "Delivery Quality", 90, "Closed 9 of 10 months on time"),
        ("Reduce invoice errors by 30%", "Delivery Quality", 70, "Error rate down 21% so far"),
        ("Cross-train two teammates on payables", "Teamwork", 100, "Completed in Q2"),
        ("Propose one process improvement per quarter", "Initiative", 60, "Two of four proposals delivered"),
    ]:
        if not exists("Goal", {"goal_name": _g, "employee": emp["rani"]}):
            make(dict(doctype="Goal", goal_name=_g, employee=emp["rani"], company=C, kra=_kra, progress=_prog,
                      status="In Progress" if _prog < 100 else "Completed", start_date=f"{Y}-01-01",
                      end_date=f"{Y}-12-31", appraisal_cycle=CYCLE, description=_desc))
    if not exists("Appraisal", {"employee": emp["rani"], "appraisal_cycle": CYCLE}):
        make(dict(doctype="Appraisal", employee=emp["rani"], company=C, appraisal_cycle=CYCLE,
                  appraisal_kra=[dict(kra="Delivery Quality", per_weightage=50), dict(kra="Teamwork", per_weightage=25),
                                 dict(kra="Initiative", per_weightage=25)]))
    # Appraisal juga untuk dewi (atasan) dan sari (HR) supaya tab "Saya" terisi di semua akun uji.
    _cyc = frappe.get_doc("Appraisal Cycle", CYCLE)
    for _k in ("dewi", "sari"):
        if not any(r.employee == emp[_k] for r in _cyc.appraisees):
            _cyc.append("appraisees", dict(employee=emp[_k]))
            _cyc.save(ignore_permissions=True)
    for _k, _goals in (
        ("dewi", [("Deliver the FY budget on schedule", "Delivery Quality", 80, "Draft approved, final review pending"),
                  ("Coach two finance staff to independence", "Teamwork", 50, "One of two completed")]),
        ("sari", [("Launch the HR mobile app pilot", "Initiative", 70, "Pilot running with three users"),
                  ("Reduce time-to-hire to 30 days", "Delivery Quality", 60, "Currently 38 days")]),
    ):
        for _g, _kra, _prog, _desc in _goals:
            if not exists("Goal", {"goal_name": _g, "employee": emp[_k]}):
                make(dict(doctype="Goal", goal_name=_g, employee=emp[_k], company=C, kra=_kra, progress=_prog,
                          status="In Progress", start_date=f"{Y}-01-01", end_date=f"{Y}-12-31",
                          appraisal_cycle=CYCLE, description=_desc))
        if not exists("Appraisal", {"employee": emp[_k], "appraisal_cycle": CYCLE}):
            make(dict(doctype="Appraisal", employee=emp[_k], company=C, appraisal_cycle=CYCLE,
                      appraisal_kra=[dict(kra="Delivery Quality", per_weightage=50), dict(kra="Teamwork", per_weightage=25),
                                     dict(kra="Initiative", per_weightage=25)],
                      self_ratings=[dict(criteria="Communication", per_weightage=40, rating=0.8),
                                    dict(criteria="Work Quality", per_weightage=40, rating=0.8),
                                    dict(criteria="Initiative", per_weightage=20, rating=0.7)]))
    _apr = frappe.db.get_value("Appraisal", {"employee": emp["rani"], "appraisal_cycle": CYCLE}, "name")
    for _rv, _rt in [("dewi", (0.9, 0.8, 0.8)), ("sari", (0.8, 0.8, 0.6))]:
        if not exists("Employee Performance Feedback", {"appraisal": _apr, "reviewer": emp[_rv]}):
            _fb = make(dict(doctype="Employee Performance Feedback", employee=emp["rani"], company=C, reviewer=emp[_rv],
                            appraisal=_apr, appraisal_cycle=CYCLE, added_on=frappe.utils.now_datetime(),
                            feedback="Reliable and detail oriented.",
                            feedback_ratings=[dict(criteria="Communication", per_weightage=40, rating=_rt[0]),
                                              dict(criteria="Work Quality", per_weightage=40, rating=_rt[1]),
                                              dict(criteria="Initiative", per_weightage=20, rating=_rt[2])]), submit=True)
    _doc = frappe.get_doc("Appraisal", _apr)
    if not _doc.self_ratings:  # penilaian diri, supaya final_score tidak tertarik ke bawah oleh self_score 0
        for _c, _w in (("Communication", 40), ("Work Quality", 40), ("Initiative", 20)):
            _doc.append("self_ratings", dict(criteria=_c, per_weightage=_w, rating=0.8))
    _doc.save(ignore_permissions=True)
    frappe.db.commit()
except Exception as ex:
    frappe.db.rollback()
    log(f"PERINGATAN: appraisal dilewati ({ex})")

# Dokumen contoh harus dimiliki (owner) user rani supaya aturan if_owner mengizinkan unggah ulang olehnya.
for _n in frappe.get_all("Employee Document", filters={"employee": emp["rani"], "owner": "Administrator"}, pluck="name"):
    frappe.db.set_value("Employee Document", _n, "owner", USERS["rani"][0], update_modified=False)
frappe.db.commit()

# 9d. Pengumuman contoh (published, audience semua karyawan)
for _t, _pr, _ct in [
    ("Office closed on Independence Day", "Normal",
     "<p>The office will be closed on <b>17 August</b>.</p><p>Regular operations resume the next working day.</p>"),
    ("Mandatory information security training", "Important",
     "<p>All employees must complete the information security training by the end of this month.</p>"
     "<p>Contact HR if you need help accessing the course.</p>"),
]:
    if not exists("HR Announcement", {"title": _t}):
        make(dict(doctype="HR Announcement", title=_t, priority=_pr, audience="All Employees", published=1, content=_ct))
frappe.db.commit()

# 9b. Notifikasi awal untuk slip gaji yang sudah ada (sekali per slip; type Alert tidak mengirim email)
for _sl in frappe.get_all("Salary Slip", filters={"docstatus": 1}, fields=["name", "employee", "start_date", "posting_date", "net_pay"]):
    _u = frappe.db.get_value("Employee", _sl.employee, "user_id")
    if _u and not frappe.db.exists("Notification Log", {"for_user": _u, "document_type": "Salary Slip", "document_name": _sl.name}):
        _n = make(dict(doctype="Notification Log", type="Alert", for_user=_u,
                       subject="Your " + frappe.utils.formatdate(_sl.start_date, "MMMM yyyy") + " payslip is available",
                       email_content="Net pay: " + str(_sl.net_pay), document_type="Salary Slip", document_name=_sl.name))
        frappe.db.set_value("Notification Log", _n.name, "creation", f"{_sl.posting_date} 09:00:00", update_modified=False)
frappe.db.commit()

# 10. API key untuk user ESS (hanya jika belum ada atau diminta) -------------------
rani_email = mail["rani"]
cur_key = frappe.db.get_value("User", rani_email, "api_key")
if not cur_key or os.environ.get("SEED_REGEN_KEYS") == "1":
    from frappe.core.doctype.user.user import generate_keys
    res = generate_keys(rani_email)
    frappe.db.commit()
    print("SEED_API_KEY=" + frappe.db.get_value("User", rani_email, "api_key"))
    print("SEED_API_SECRET=" + res["api_secret"])
log("selesai")
