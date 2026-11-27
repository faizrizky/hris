# Pustaka paket langganan site ini (disisipkan lewat "# @include: _lib/paket_lib.py", atau otomatis oleh "# @fitur: x").
# Fitur per paket mengikuti tabel harga di landing (hris-cms/src/seed/content.ts, PRICING_MATRIX); aplikasi mobile
# hanya membaca daftar "fitur" dari sini, jadi kunci baru cukup ditambah di satu tempat ini.
def pk_info():
    # Satu baris HRIS Subscription per site klien, dikirim dari sentra (sentra_ats.subscription.apply_local).
    rows = frappe.get_all("HRIS Subscription", fields=["plan", "enabled", "valid_until"], limit=1)
    lg = rows[0] if rows else {}
    paket = lg.get("plan") or "Basic"
    sampai = lg.get("valid_until")
    aktif = bool(lg.get("enabled", 1)) and (not sampai or str(sampai) >= frappe.utils.nowdate())
    dasar = ["absensi", "koreksi_absensi", "cuti", "slip_gaji", "keamanan"]
    essential = dasar + ["lembur", "dinas_wfh", "pajak_bpjs", "dokumen", "pengumuman"]
    fitur = {"Basic": dasar, "Essential": essential, "Suite": essential + ["penilaian_kinerja"]}.get(paket, dasar)
    return {"paket": paket, "berlaku_sampai": str(sampai) if sampai else None, "aktif": aktif,
            "fitur": fitur if aktif else []}
