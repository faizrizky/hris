# Pustaka paket langganan site ini (disisipkan lewat "# @include: _lib/paket_lib.py", atau otomatis oleh "# @fitur: x").
# Fitur per paket mengikuti tabel harga di landing (hris-cms/src/seed/content.ts, PRICING_MATRIX); aplikasi mobile
# hanya membaca daftar "fitur" dari sini, jadi kunci baru cukup ditambah di satu tempat ini.
def pk_info():
    lg = frappe.get_doc("Langganan HRIS")  # get_single_value membaca Date kosong sebagai 0001-01-01
    paket = lg.paket or "Basic"
    sampai = lg.berlaku_sampai
    aktif = bool(lg.aktif) and (not sampai or str(sampai) >= frappe.utils.nowdate())
    dasar = ["absensi", "koreksi_absensi", "cuti", "slip_gaji", "keamanan"]
    essential = dasar + ["lembur", "dinas_wfh", "pajak_bpjs", "dokumen", "pengumuman"]
    fitur = {"Basic": dasar, "Essential": essential, "Suite": essential + ["penilaian_kinerja"]}.get(paket, dasar)
    return {"paket": paket, "berlaku_sampai": str(sampai) if sampai else None, "aktif": aktif,
            "fitur": fitur if aktif else []}
