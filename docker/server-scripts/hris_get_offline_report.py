# Server Script (type: API, method: hris_get_offline_report, allow_guest: 0)
# GET ?month=YYYY-MM (default bulan ini). Hanya HR User/Manager. Per karyawan: jumlah check-in offline,
# Needs Review, Approved, Rejected, rata-rata skew (detik).
user = frappe.session.user
is_hr = user == "Administrator" or len(
    frappe.get_all("Has Role", filters={"parent": user, "parenttype": "User",
                                        "role": ["in", ["HR User", "HR Manager"]]}, limit_page_length=1)
) > 0
if not is_hr:
    frappe.throw("Only HR can view the offline check-in report", frappe.PermissionError)
month = frappe.form_dict.get("month") or frappe.utils.nowdate()[:7]
if len(month) != 7 or month[4] != "-" or not (month[:4] + month[5:]).isdigit():
    frappe.throw("month must be YYYY-MM")
first = month + "-01"
last = str(frappe.utils.get_last_day(first))
stats = {}
order = []
for c in frappe.get_all("Employee Checkin",
                        filters={"custom_offline": 1, "time": ["between", [first + " 00:00:00", last + " 23:59:59"]]},
                        fields=["employee", "employee_name", "custom_review_status", "custom_clock_skew_seconds"],
                        limit_page_length=5000):
    if c.employee not in stats:
        stats[c.employee] = {"employee": c.employee, "employee_name": c.employee_name, "offline_count": 0,
                             "needs_review": 0, "approved": 0, "rejected": 0, "skew_total": 0}
        order.append(c.employee)
    s = stats[c.employee]
    s["offline_count"] = s["offline_count"] + 1
    s["skew_total"] = s["skew_total"] + (c.custom_clock_skew_seconds or 0)
    if c.custom_review_status == "Needs Review":
        s["needs_review"] = s["needs_review"] + 1
    elif c.custom_review_status == "Approved":
        s["approved"] = s["approved"] + 1
    elif c.custom_review_status == "Rejected":
        s["rejected"] = s["rejected"] + 1
result = []
for k in order:
    s = stats[k]
    result.append({"employee": s["employee"], "employee_name": s["employee_name"], "offline_count": s["offline_count"],
                   "needs_review": s["needs_review"], "approved": s["approved"], "rejected": s["rejected"],
                   "avg_skew_seconds": round(s["skew_total"] / s["offline_count"], 1)})
frappe.response["message"] = {"month": month, "employees": result}
