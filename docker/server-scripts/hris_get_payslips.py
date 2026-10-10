# Server Script (type: API, method: hris_get_payslips, allow_guest: 0)
# Slip gaji (submitted) milik pemanggil, terbaru dulu, maks 12. Hanya slip Employee pemanggil.
# Panggil: GET /api/method/hris_get_payslips
result = []
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)
if me:
    slips = frappe.get_all(
        "Salary Slip",
        filters={"employee": me[0].name, "docstatus": 1},
        fields=[
            "name", "start_date", "end_date", "posting_date", "status", "bank_account_no",
            "gross_pay", "total_deduction", "net_pay",
        ],
        order_by="start_date desc",
        limit_page_length=12,
    )
    for s in slips:
        item = {
            "name": s.name,
            "start_date": str(s.start_date),
            "end_date": str(s.end_date),
            "posting_date": str(s.posting_date),
            "status": s.status,
            "bank_account_no": s.bank_account_no,
            "gross_pay": s.gross_pay,
            "total_deduction": s.total_deduction,
            "net_pay": s.net_pay,
            "earnings": [],
            "deductions": [],
        }
        for fieldname in ["earnings", "deductions"]:
            for d in frappe.get_all(
                "Salary Detail",
                filters={"parent": s.name, "parenttype": "Salary Slip", "parentfield": fieldname},
                fields=["salary_component", "amount"],
                order_by="idx asc",
                parent_doctype="Salary Slip",
                limit_page_length=100,
            ):
                item[fieldname].append({"salary_component": d.salary_component, "amount": d.amount})
        result.append(item)
frappe.response["message"] = result
