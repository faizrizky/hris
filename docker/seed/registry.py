"""Registry tenant HRIS: site khusus (tanpa erpnext/hrms) yang memetakan kode company -> site klien.
Dijalankan DI DALAM container backend oleh registry.sh. Idempotent.
Aplikasi mobile memanggil hris_cek_company sebelum login; paket/fitur dibaca dari site klien (hris_get_langganan),
jadi registry tidak menyimpan paket supaya tidak ada dua sumber data."""
import os
import frappe

SITE = os.environ.get("REGISTRY_SITE", "admin.localhost")
frappe.init(site=SITE, sites_path="/home/frappe/frappe-bench/sites")
frappe.connect()
frappe.set_user("Administrator")


def log(msg):
    print("[registry]", msg)


if not frappe.db.exists("DocType", "HRIS Tenant"):
    frappe.get_doc(dict(
        doctype="DocType", name="HRIS Tenant", module="Custom", custom=1, autoname="field:kode",
        naming_rule="By fieldname", title_field="nama_company", show_title_field_in_link=1,
        fields=[
            dict(fieldname="kode", label="Kode Company", fieldtype="Data", reqd=1, unique=1, in_list_view=1,
                 description="Yang diketik karyawan di aplikasi. Tidak membedakan huruf besar/kecil."),
            dict(fieldname="nama_company", label="Nama Company", fieldtype="Data", reqd=1, in_list_view=1),
            dict(fieldname="site", label="Site", fieldtype="Data", reqd=1, in_list_view=1,
                 description="Nama site Frappe di bench, mis. klien-a.hris.domain"),
            dict(fieldname="base_url", label="Base URL", fieldtype="Data",
                 description="Alamat yang dihubungi aplikasi. Kosong = server yang sama dengan registry (dev)."),
            dict(fieldname="channel", label="Channel Update", fieldtype="Data",
                 description="Channel EAS Update khusus company ini (mis. pilot). Kosong = channel bawaan build."),
            dict(fieldname="aktif", label="Aktif", fieldtype="Check", default="1", in_list_view=1),
        ],
        permissions=[dict(role="System Manager", read=1, write=1, create=1, delete=1)],
    )).insert(ignore_permissions=True)
    frappe.clear_cache()
    log("dibuat DocType: HRIS Tenant")

# Tenant dev: site default dan site uji kedua (dibuat lewat ./site-baru.sh).
for kode, nama, site in [("HRIS", "Falah Test", "hris.localhost"), ("KLIENB", "Klien B (uji)", "klien-b.localhost")]:
    if not frappe.db.exists("HRIS Tenant", kode):
        frappe.get_doc(dict(doctype="HRIS Tenant", kode=kode, nama_company=nama, site=site, aktif=1)).insert(ignore_permissions=True)
        log(f"dibuat tenant: {kode} -> {site}")

code = open(os.path.join(os.path.dirname(__file__), "server-scripts/hris_cek_company.py"), encoding="utf-8").read()
vals = dict(script_type="API", api_method="hris_cek_company", allow_guest=1, disabled=0, script=code,
            enable_rate_limit=1, rate_limit_count=10, rate_limit_seconds=60)  # cegah menebak kode
if frappe.db.exists("Server Script", "hris_cek_company"):
    doc = frappe.get_doc("Server Script", "hris_cek_company")
    if any(doc.get(k) != v for k, v in vals.items()):
        doc.update(vals)
        doc.save(ignore_permissions=True)
        log("diperbarui Server Script: hris_cek_company")
else:
    frappe.get_doc(dict(doctype="Server Script", name="hris_cek_company", **vals)).insert(ignore_permissions=True)
    log("dibuat Server Script: hris_cek_company")
frappe.db.commit()
frappe.clear_cache()
