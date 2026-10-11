# Server Script (type: API, method: hris_get_my_documents, allow_guest: 0)
# Dokumen digital milik pemanggil, terbaru dulu. "expiring" dihitung oleh aplikasi dari expires_on.
# Hasil: [{"name","document_name","category","ext","size_bytes","uploaded_on","expires_on","status","file_url"}]
result = []
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name"], limit_page_length=1)
if me:
    for q in frappe.get_all("Employee Document", filters={"employee": me[0].name},
                            fields=["name", "document_name", "category", "file", "expires_on", "status", "creation", "rejection_reason"],
                            order_by="creation desc", limit_page_length=100):
        ext = None
        size = None
        furl = q.file
        fname = None
        # upload_file hanya melampirkan File ke dokumen (field Attach tidak ikut terisi), jadi cari File terbaru.
        f = frappe.get_all("File", filters={"attached_to_doctype": "Employee Document", "attached_to_name": q.name},
                           fields=["file_url", "file_size", "file_name"], order_by="creation desc", limit_page_length=1)
        if f:
            furl = f[0].file_url
            fname = f[0].file_name
            size = f[0].file_size
            ext = f[0].file_name.split(".")[-1].upper() if "." in f[0].file_name else None
        result.append({
            "name": q.name,
            "document_name": q.document_name,
            "category": q.category,
            "ext": ext,
            "size_bytes": size,
            "uploaded_on": str(q.creation)[:10],
            "expires_on": str(q.expires_on) if q.expires_on else None,
            "status": q.status,
            "file_url": furl,
            "file_name": fname,
            "rejection_reason": q.rejection_reason,
        })
frappe.response["message"] = result
