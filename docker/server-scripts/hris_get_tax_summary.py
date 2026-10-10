# Server Script (type: API, method: hris_get_tax_summary, allow_guest: 0)
# Ringkasan pajak/BPJS tahun berjalan dari Salary Slip submitted milik pemanggil.
# PPh 21 = komponen "PPh 21"; BPJS = jumlah komponen berawalan "BPJS". PTKP/NPWP/TER tidak tersedia.
# Hasil: {"year", "months":[{"month","pph21","bpjs","gross"}x12], "latest":{...}} atau null bila tidak ada slip.
names_id = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
            "September", "Oktober", "November", "Desember"]
result = None
me = frappe.get_all(
    "Employee",
    filters={"user_id": frappe.session.user, "status": "Active"},
    fields=["name"],
    limit_page_length=1,
)
if me:
    year = int(frappe.utils.nowdate()[:4])
    slips = frappe.get_all(
        "Salary Slip",
        filters={
            "employee": me[0].name,
            "docstatus": 1,
            "start_date": ["between", [str(year) + "-01-01", str(year) + "-12-31"]],
        },
        fields=["name", "start_date", "gross_pay"],
        order_by="start_date asc",
        limit_page_length=24,
    )
    if slips:
        months = [{"month": m, "pph21": 0, "bpjs": 0, "gross": 0} for m in range(1, 13)]
        latest = None
        for s in slips:
            idx = int(str(s.start_date)[5:7]) - 1
            months[idx]["gross"] = months[idx]["gross"] + s.gross_pay
            bpjs_items = []
            pph = 0
            for d in frappe.get_all(
                "Salary Detail",
                filters={"parent": s.name, "parenttype": "Salary Slip", "parentfield": "deductions"},
                fields=["salary_component", "amount"],
                order_by="idx asc",
                parent_doctype="Salary Slip",
                limit_page_length=100,
            ):
                if d.salary_component == "PPh 21":
                    pph = pph + d.amount
                elif d.salary_component.startswith("BPJS"):
                    bpjs_items.append({"label": d.salary_component, "amount": d.amount})
            months[idx]["pph21"] = months[idx]["pph21"] + pph
            months[idx]["bpjs"] = months[idx]["bpjs"] + sum([b["amount"] for b in bpjs_items])
            latest = {
                "period": names_id[idx] + " " + str(year),
                "gross_pay": s.gross_pay,
                "pph21": pph,
                "bpjs": bpjs_items,
            }
        result = {"year": year, "months": months, "latest": latest}
frappe.response["message"] = result
