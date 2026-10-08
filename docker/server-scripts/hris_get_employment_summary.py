# Server Script (type: API, method: hris_get_employment_summary, allow_guest: 0)
# Ringkasan jumlah karyawan Active per employment_type. Hanya HR User / HR Manager; selain itu null.
# Panggil: GET /api/method/hris_get_employment_summary
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all(
        "Has Role",
        filters={
            "parent": user,
            "parenttype": "User",
            "role": ["in", ["HR User", "HR Manager"]],
        },
        limit_page_length=1,
    )
) > 0
result = None
if is_hr:
    counts = {}
    order = []
    for e in frappe.get_all("Employee", filters={"status": "Active"}, fields=["employment_type"], limit_page_length=5000):
        label = e.employment_type or "Tidak diisi"
        if label not in counts:
            counts[label] = 0
            order.append(label)
        counts[label] = counts[label] + 1
    result = [{"label": k, "count": counts[k]} for k in sorted(order)]
frappe.response["message"] = result
