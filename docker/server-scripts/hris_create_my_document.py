# Server Script (type: API, method: hris_create_my_document, allow_guest: 0)
# Langkah 1 unggah dokumen: buat Employee Document (status Pending) untuk Employee pemanggil.
# POST: document_name, category (Contract|Decree|Certificate|Identity), expires_on (YYYY-MM-DD, opsional).
# Langkah 2: POST /api/method/upload_file (multipart: file, is_private=1, doctype="Employee Document",
#   docname=<name hasil langkah 1>, fieldname="file"). Batas 5 MB, tipe PDF/JPG/PNG.
fd = frappe.form_dict
doc_name = (fd.get("document_name") or "").strip()
category = fd.get("category")
expires_on = fd.get("expires_on") or None
if not doc_name or len(doc_name) > 140:
    frappe.throw("document_name is required (max 140 characters)")
if category not in ("Contract", "Decree", "Certificate", "Identity"):
    frappe.throw("category must be Contract, Decree, Certificate or Identity")
me = frappe.get_all("Employee", filters={"user_id": frappe.session.user, "status": "Active"},
                    fields=["name", "employee_name"], limit_page_length=1)
if not me:
    frappe.throw("This account is not linked to an active employee")
doc = frappe.get_doc({"doctype": "Employee Document", "employee": me[0].name, "document_name": doc_name,
                      "category": category, "expires_on": expires_on, "status": "Pending"})
doc.insert(ignore_permissions=True)
hr_users = frappe.get_all("Has Role", filters={"role": "HR Manager", "parenttype": "User"}, pluck="parent",
                          limit_page_length=50)
for u in hr_users:
    if u != "Administrator":
        frappe.get_doc({"doctype": "Notification Log", "type": "Alert", "for_user": u,
                        "subject": "New document from " + str(me[0].employee_name) + " is waiting for verification",
                        "email_content": doc_name + " (" + category + ")",
                        "document_type": "Employee Document", "document_name": doc.name}).insert(ignore_permissions=True)
frappe.response["message"] = {"name": doc.name, "document_name": doc_name, "category": category,
                              "expires_on": expires_on, "status": "Pending"}
