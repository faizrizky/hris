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

# Menu satu pintu di Desk registry: kartu angka, pintasan, dan langkah menambah klien.
import json
import uuid


def _blk(kind, data=None):
    return {"id": uuid.uuid4().hex[:10], "type": kind, "data": data or {}}


def _hdr(text):
    return _blk("header", {"text": f'<span class="h4"><b>{text}</b></span>', "col": 12})


def _para(text):
    return _blk("paragraph", {"text": text, "col": 12})


for _label, _flt, _color in [("Tenant Aktif", [["HRIS Tenant", "aktif", "=", 1]], "#29CD42"),
                             ("Tenant Nonaktif", [["HRIS Tenant", "aktif", "=", 0]], "#E24C4C")]:
    if not frappe.db.exists("Number Card", _label):
        frappe.get_doc(dict(doctype="Number Card", label=_label, document_type="HRIS Tenant", function="Count",
                            filters_json=json.dumps(_flt), color=_color, is_public=1)).insert(ignore_permissions=True)

_WS = "Tenant HRIS"
ws = frappe.get_doc("Workspace", _WS) if frappe.db.exists("Workspace", _WS) else frappe.new_doc("Workspace")
ws.name = _WS
ws.update(dict(label=_WS, title=_WS, module="Custom", icon="building", public=1, is_hidden=0, sequence_id=1))
ws.set("number_cards", [])
ws.set("shortcuts", [])
ws.set("links", [])
for _n in ("Tenant Aktif", "Tenant Nonaktif"):
    ws.append("number_cards", {"number_card_name": _n, "label": _n})
ws.append("shortcuts", {"label": "Daftar Tenant", "link_to": "HRIS Tenant", "type": "DocType", "color": "Blue"})
ws.append("shortcuts", {"label": "Tambah Tenant", "link_to": "HRIS Tenant", "type": "DocType", "color": "Green",
                        "doc_view": "New"})
ws.append("links", {"type": "Card Break", "label": "Tenant", "hidden": 0})
ws.append("links", {"type": "Link", "label": "HRIS Tenant", "link_type": "DocType", "link_to": "HRIS Tenant",
                    "onboard": 0})
ws.content = json.dumps([
    _hdr("Klien"),
    _blk("number_card", {"number_card_name": "Tenant Aktif", "col": 3}),
    _blk("number_card", {"number_card_name": "Tenant Nonaktif", "col": 3}),
    _blk("spacer"),
    _hdr("Pintasan"),
    _blk("shortcut", {"shortcut_name": "Daftar Tenant", "col": 3}),
    _blk("shortcut", {"shortcut_name": "Tambah Tenant", "col": 3}),
    _blk("spacer"),
    _hdr("Menambah klien baru"),
    _para("1. Di server, jalankan <b>./site-baru.sh namaklien.domain</b> (membuat site dan mengisinya)."),
    _para("2. Klik <b>Tambah Tenant</b>: isi Kode Company (yang diketik karyawan), Nama, dan Site tadi."),
    _para("3. Buka tenant itu, klik <b>Atur Paket</b> untuk memilih Basic/Essential/Suite dan masa berlaku."),
    _para("4. Klien berhenti: hilangkan centang <b>Aktif</b> pada tenant-nya."),
])
ws.flags.ignore_permissions = True
ws.save()
log("workspace: " + _WS)

# Tombol di form tenant menuju site klien (alamat dibentuk dari site + port yang sedang dipakai browser).
_CS = "HRIS Tenant - tautan site"
_js = """frappe.ui.form.on('HRIS Tenant', {
    refresh(frm) {
        if (frm.is_new() || !frm.doc.site) return;
        const port = window.location.port ? ':' + window.location.port : '';
        const base = frm.doc.base_url || (window.location.protocol + '//' + frm.doc.site + port);
        frm.add_custom_button(__('Atur Paket'), () => window.open(base + '/desk/langganan-hris'), __('Buka'));
        frm.add_custom_button(__('Desk Site Klien'), () => window.open(base + '/desk'), __('Buka'));
        frm.add_custom_button(__('Seed Ulang Script'), () => frappe.msgprint(
            'Di server: <code>./seed/seed.sh ' + frappe.utils.escape_html(frm.doc.site) + '</code>'), __('Buka'));
    },
});"""
if frappe.db.exists("Client Script", _CS):
    frappe.db.set_value("Client Script", _CS, {"script": _js, "enabled": 1})
else:
    frappe.get_doc(dict(doctype="Client Script", name=_CS, dt="HRIS Tenant", view="Form", enabled=1,
                        script=_js)).insert(ignore_permissions=True)

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
