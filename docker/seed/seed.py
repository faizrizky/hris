"""Seed idempotent data uji HRIS. Dijalankan DI DALAM container backend oleh seed.sh.
Semua langkah memeriksa keberadaan data lebih dulu, jadi aman dijalankan berulang.
Password dibaca dari environment (diteruskan seed.sh dari docker/.credentials.local)."""
import os
import frappe
from frappe.utils import nowdate

SITE = os.environ.get("SITE_NAME", "hris.localhost")
frappe.init(site=SITE, sites_path="/home/frappe/frappe-bench/sites")
frappe.connect()
frappe.set_user("Administrator")
Y = int(nowdate()[:4])
C, ABBR = "Falah Test", "FT"
HL = f"Libur {Y}"
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

# 2. Holiday list ----------------------------------------------------------
if not exists("Holiday List", HL):
    make(dict(doctype="Holiday List", holiday_list_name=HL, from_date=f"{Y}-01-01",
              to_date=f"{Y}-12-31", weekly_off="Sunday", holidays=[
                  dict(holiday_date=f"{Y}-01-01", description="Tahun Baru"),
                  dict(holiday_date=f"{Y}-08-17", description="Hari Kemerdekaan RI"),
                  dict(holiday_date=f"{Y}-12-25", description="Hari Natal")]))

# 3. Department, designation, leave type, policy ---------------------------
for d in ["Keuangan", "People Ops"]:
    if not exists("Department", f"{d} - {ABBR}"):
        make(dict(doctype="Department", department_name=d, company=C, parent_department="All Departments"))
for dg in ["Manajer Keuangan", "Staf Keuangan", "Staf HR"]:
    if not exists("Designation", dg):
        make(dict(doctype="Designation", designation_name=dg))
for lt in ["Cuti Tahunan", "Cuti Sakit"]:
    if not exists("Leave Type", lt):
        make(dict(doctype="Leave Type", leave_type_name=lt, include_holiday=0, max_leaves_allowed=12))
LP = "Kebijakan Cuti Standar"
if not exists("Leave Policy", {"title": LP}):
    make(dict(doctype="Leave Policy", title=LP, leave_policy_details=[
        dict(leave_type="Cuti Tahunan", annual_allocation=12),
        dict(leave_type="Cuti Sakit", annual_allocation=12)]), submit=True)
LP_NAME = frappe.db.get_value("Leave Policy", {"title": LP}, "name")
if not exists("Shift Type", "Shift Pagi"):
    make(dict(doctype="Shift Type", name="Shift Pagi", start_time="08:00:00", end_time="17:00:00"))
frappe.db.commit()

# 4. Employee --------------------------------------------------------------
EMPLOYEES = [  # (key, first, last, gender, dept, designation)
    ("rani", "Rani", "Test", "Female", "Keuangan", "Staf Keuangan"),
    ("budi", "Budi", "Santoso", "Male", "Keuangan", "Staf Keuangan"),
    ("dewi", "Dewi", "Kusuma", "Female", "Keuangan", "Manajer Keuangan"),
    ("sari", "Sari", "Wulandari", "Female", "People Ops", "Staf HR"),
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
        make(dict(doctype="Shift Assignment", employee=e, shift_type="Shift Pagi", company=C,
                  start_date=f"{Y}-01-01", end_date=f"{Y}-12-31", status="Active"), submit=True)
frappe.db.commit()

# 8. Salary structure + slip contoh (opsional) ----------------------------------
try:
    for n, t, ab in [("Gaji Pokok", "Earning", "GP"), ("Potongan BPJS", "Deduction", "BPJS")]:
        if not exists("Salary Component", n):
            make(dict(doctype="Salary Component", salary_component=n, salary_component_abbr=ab, type=t))
    if not exists("Salary Structure", "Struktur Gaji Standar"):
        make(dict(doctype="Salary Structure", name="Struktur Gaji Standar", company=C, currency="IDR",
                  payroll_frequency="Monthly", is_active="Yes",
                  earnings=[dict(salary_component="Gaji Pokok", amount=10000000)],
                  deductions=[dict(salary_component="Potongan BPJS", amount=200000)]), submit=True)
    for e in emp.values():
        if not exists("Salary Structure Assignment", {"employee": e, "docstatus": 1}):
            make(dict(doctype="Salary Structure Assignment", employee=e, salary_structure="Struktur Gaji Standar",
                      from_date=f"{Y}-01-01", company=C, base=10000000), submit=True)
        if not exists("Salary Slip", {"employee": e}):
            make(dict(doctype="Salary Slip", employee=e, posting_date=f"{Y}-09-30", start_date=f"{Y}-09-01",
                      end_date=f"{Y}-09-30", salary_structure="Struktur Gaji Standar"), submit=True)
    frappe.db.commit()
except Exception as ex:
    frappe.db.rollback()
    log(f"PERINGATAN: salary dilewati ({ex})")

# Employee Checkin.time berada di permlevel 1, sehingga nilai `time` dari role Employee diabaikan
# diam-diam (diganti jam server). Izin tulis permlevel 1 dibutuhkan agar antrean offline bisa
# mengirim waktu aslinya.
from frappe.permissions import add_permission, update_permission_property
if not frappe.db.exists("Custom DocPerm", {"parent": "Employee Checkin", "role": "Employee", "permlevel": 1, "write": 1}):
    add_permission("Employee Checkin", "Employee", 1)
    update_permission_property("Employee Checkin", "Employee", 1, "write", 1)
    frappe.db.commit()
    log("izin tulis permlevel 1 Employee Checkin untuk role Employee ditambahkan")

# Custom Field delegasi cuti. ignore_user_permissions=1 supaya ESS boleh memilih rekan
# yang tidak termasuk User Permission-nya (Employee dirinya sendiri).
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

EVENT_SCRIPTS = {}  # isi {"nama_file": ("DocType", "Before Save")} untuk script berbasis event dokumen

# 9. Server Script (satu file .py per script, nama file = nama method API) ----------
if os.path.isdir(SS_DIR):
    for fname in sorted(os.listdir(SS_DIR)):
        if not fname.endswith(".py"):
            continue
        name = fname[:-3]
        code = open(os.path.join(SS_DIR, fname), encoding="utf-8").read()
        vals = dict(script_type="API", api_method=name, allow_guest=0, disabled=0, script=code)
        if name in EVENT_SCRIPTS:  # script berbasis event dokumen, bukan API
            vals = dict(script_type="DocType Event", reference_doctype=EVENT_SCRIPTS[name][0],
                        doctype_event=EVENT_SCRIPTS[name][1], disabled=0, script=code)
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
