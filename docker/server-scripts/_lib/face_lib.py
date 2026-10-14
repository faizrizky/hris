# Pustaka verifikasi wajah (disisipkan lewat "# @include: _lib/face_lib.py"; Server Script tidak bisa import).
# Embedding = daftar 128 angka (SFace). Kemiripan = cosine x100.
def fl_parse(raw):
    if not raw:
        return None
    v = json.loads(raw) if isinstance(raw, str) else raw
    if not v or len(v) != 128:
        return None
    return fl_norm([float(x) for x in v])

def fl_norm(v):
    n = sum([x * x for x in v]) ** 0.5
    if n == 0:
        return None
    return [x / n for x in v]

def fl_centroid(vs):
    acc = [0.0] * 128
    for v in vs:
        for i in range(128):
            acc[i] = acc[i] + v[i]
    return fl_norm(acc)

def fl_pct(a, b):
    if not a or not b:
        return None
    return frappe.utils.flt(sum([a[i] * b[i] for i in range(128)]) * 100.0, 1)

def fl_setting(field, default):
    v = frappe.db.get_single_value("Face Settings", field)
    return default if v is None else v

def fl_hr_users():
    return [r.parent for r in frappe.get_all("Has Role", filters={"parenttype": "User", "role": ["in", ["HR User", "HR Manager"]]},
                                              fields=["parent"], limit_page_length=200)
            if r.parent not in ("Administrator", "Guest")]

def fl_notify(user, subject, body, doctype, name):
    if user:
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": user, "subject": subject,
                        "email_content": body, "document_type": doctype, "document_name": name}).insert(ignore_permissions=True)

def fl_active(emp):
    r = frappe.get_all("Face Enrollment", filters={"employee": emp, "status": "Active"},
                       fields=["name", "face_embeddings", "ktp_embedding", "profile_embedding", "needs_reenroll", "grace_until"],
                       order_by="creation desc", limit_page_length=1)
    return r[0] if r else None

def fl_ktp(emp):
    r = frappe.get_all("Employee Document", filters={"employee": emp, "category": "Identity", "status": "Verified",
                                                     "document_name": ["like", "%KTP%"], "file": ["is", "set"]},
                       fields=["name", "file"], order_by="modified desc", limit_page_length=1)
    return r[0] if r else None

# Menyimpan foto JPEG (base64) sebagai berkas privat dan menautkannya ke field dokumen. Karyawan tidak punya hak
# langsung ke dokumen ini, jadi server yang menyimpannya (bukan upload_file dari aplikasi).
def fl_attach(dt, name, field, b64, fname):
    if not b64:
        return None
    if len(b64) > 7000000:
        frappe.throw("The photo is larger than 5 MB")
    if not b64.startswith("/9j/"):
        frappe.throw("Only JPEG photos are accepted")
    f = frappe.get_doc({"doctype": "File", "file_name": fname, "content": b64, "decode": 1, "is_private": 1,
                        "attached_to_doctype": dt, "attached_to_name": name, "attached_to_field": field})
    f.insert(ignore_permissions=True)
    frappe.db.set_value(dt, name, field, f.file_url)
    return f.file_url
