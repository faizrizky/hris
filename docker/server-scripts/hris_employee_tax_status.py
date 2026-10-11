# Server Script (type: DocType Event, doctype: Employee, event: Before Save)
# Hitung custom_ptkp_status (TK/n atau K/n) dan custom_ter_category (A/B/C) dari marital_status dan tanggungan.
# n = anggota keluarga is_dependent bukan Spouse, maks 3. Kawin (Married) -> K, selain itu TK.
deps = 0
for m in doc.custom_family_members:
    if m.is_dependent and m.relation != "Spouse":
        deps = deps + 1
if deps > 3:
    deps = 3
status = ("K/" if doc.marital_status == "Married" else "TK/") + str(deps)
if status in ("TK/0", "TK/1", "K/0"):
    cat = "A"
elif status in ("TK/2", "TK/3", "K/1", "K/2"):
    cat = "B"
else:
    cat = "C"
doc.custom_ptkp_status = status
doc.custom_ter_category = cat
