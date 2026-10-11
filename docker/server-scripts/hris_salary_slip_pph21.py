# Server Script (type: DocType Event, doctype: Salary Slip, event: Before Save)
# PPh 21 otomatis (PMK 168/2023) untuk slip draft:
#  - Bila Employee.custom_tarif_pph21 > 0 (HR mengisi tarif manual): rumus Salary Structure dipakai apa adanya.
#  - Bila 0 / kosong: Januari-November = bruto slip x tarif TER (kategori dari Employee.custom_ter_category,
#    tabel doctype "PPh21 TER Rate"); Desember = penyesuaian tahunan:
#      neto = bruto setahun - biaya jabatan (5% maks Rp6.000.000/th) - iuran pensiun (BPJS JHT + JP karyawan)
#      PKP  = neto - PTKP (54.000.000 + 4.500.000 bila kawin + 4.500.000 per tanggungan maks 3), dibulatkan ke bawah per 1.000
#      pajak tahunan = tarif Pasal 17 (5% s.d. 60jt, 15% s.d. 250jt, 25% s.d. 500jt, 30% s.d. 5M, 35% di atasnya)
#      PPh Desember = max(0, pajak tahunan - PPh Jan-Nov yang sudah dipotong pada slip submitted tahun itu)
if doc.docstatus == 0:
    emp = frappe.db.get_value("Employee", doc.employee,
                              ["custom_tarif_pph21", "custom_ptkp_status", "custom_ter_category"], as_dict=True)
    manual = emp and (emp.custom_tarif_pph21 or 0) > 0
    row = None
    for d in doc.deductions:
        if d.salary_component == "Income Tax (PPh 21)":
            row = d
    if row and emp and not manual and emp.custom_ter_category:
        gross = doc.gross_pay or 0
        month = int(str(doc.start_date)[5:7])
        year = str(doc.start_date)[:4]
        tax = 0
        if month < 12:
            tr = frappe.get_all("PPh21 TER Rate",
                                filters={"category": emp.custom_ter_category, "bruto_from": ["<=", gross]},
                                fields=["rate"], order_by="bruto_from desc", limit_page_length=1)
            rate = tr[0].rate if tr else 0
            tax = round(gross * rate / 100.0)
        else:
            prev = frappe.get_all("Salary Slip",
                                  filters={"employee": doc.employee, "docstatus": 1,
                                           "start_date": ["between", [year + "-01-01", year + "-12-31"]]},
                                  fields=["name", "gross_pay"], limit_page_length=24)
            annual_gross = gross
            paid = 0
            pension = 0
            for c in doc.deductions:
                if c.salary_component == "BPJS JHT" or c.salary_component == "BPJS JP":
                    pension = pension + c.amount
            for p in prev:
                annual_gross = annual_gross + (p.gross_pay or 0)
                for c in frappe.get_all("Salary Detail", filters={"parent": p.name, "parentfield": "deductions"},
                                        fields=["salary_component", "amount"], parent_doctype="Salary Slip",
                                        limit_page_length=50):
                    if c.salary_component == "Income Tax (PPh 21)":
                        paid = paid + c.amount
                    elif c.salary_component == "BPJS JHT" or c.salary_component == "BPJS JP":
                        pension = pension + c.amount
            job_cost = annual_gross * 0.05
            if job_cost > 6000000:
                job_cost = 6000000
            neto = annual_gross - job_cost - pension
            st = emp.custom_ptkp_status or "TK/0"
            ptkp = 54000000 + (4500000 if st.startswith("K/") else 0) + 4500000 * int(st[-1])
            pkp = neto - ptkp
            if pkp < 0:
                pkp = 0
            pkp = int(pkp // 1000) * 1000
            annual_tax = 0
            rest = pkp
            for lim, r in ((60000000, 0.05), (190000000, 0.15), (250000000, 0.25), (4500000000, 0.30)):
                part = rest if rest < lim else lim
                annual_tax = annual_tax + part * r
                rest = rest - part
                if rest <= 0:
                    break
            if rest > 0:
                annual_tax = annual_tax + rest * 0.35
            tax = round(annual_tax - paid)
            if tax < 0:
                tax = 0
        row.amount = tax
        doc.set_net_pay()
