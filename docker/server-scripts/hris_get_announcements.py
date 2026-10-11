# Server Script (type: API, method: hris_get_announcements, allow_guest: 0)
# GET ?limit=30. Pengumuman published, belum kedaluwarsa, sesuai audience pemanggil (semua / departemennya).
# Hasil: [{"name","title","content","content_html","priority","published_on","expires_on","attachments","posted_by"}]
limit = int(frappe.form_dict.get("limit") or 30)
if limit > 100:
    limit = 100
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["department"], limit_page_length=1)
dept = me[0].department if me else None
today = frappe.utils.nowdate()
result = []
for a in frappe.get_all("HR Announcement", filters={"published": 1},
                        fields=["name", "title", "content", "priority", "audience", "department", "published_on",
                                "expires_on", "attachment", "owner"],
                        order_by="published_on desc", limit_page_length=300):
    if a.expires_on and str(a.expires_on) < today:
        continue
    if a.audience == "Department" and a.department != dept:
        continue
    html = a.content or ""
    text = html.replace("</p>", "\n").replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    text = frappe.utils.strip_html(text).strip()
    atts = []
    seen = []
    for f in frappe.get_all("File", filters={"attached_to_doctype": "HR Announcement", "attached_to_name": a.name},
                            fields=["file_name", "file_url"], order_by="creation asc", limit_page_length=20):
        atts.append({"file_name": f.file_name, "file_url": f.file_url})
        seen.append(f.file_url)
    if a.attachment and a.attachment not in seen:
        atts.append({"file_name": a.attachment.split("/")[-1], "file_url": a.attachment})
    result.append({"name": a.name, "title": a.title, "content": text, "content_html": html, "priority": a.priority,
                   "published_on": str(a.published_on)[:19].replace(" ", "T") if a.published_on else None,
                   "expires_on": str(a.expires_on) if a.expires_on else None, "attachments": atts,
                   "posted_by": frappe.db.get_value("User", a.owner, "full_name") or a.owner})
    if len(result) >= limit:
        break
frappe.response["message"] = result
