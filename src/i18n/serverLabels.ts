// ERPNext dibuat berbahasa Inggris supaya data dan Server Script netral bahasa.
// Semua terjemahan ke Indonesia untuk teks yang datang dari server ada di
// file ini, jadi menambah bahasa lain cukup di satu tempat. Nilai yang tidak
// dikenal (mis. nama departemen baru) ditampilkan apa adanya.

import { bahasaAktif } from "./index";

const ID = {
  leaveType: {
    "Annual Leave": "Cuti Tahunan",
    "Sick Leave": "Cuti Sakit",
  },
  salaryComponent: {
    "Basic Salary": "Gaji Pokok",
    "Transport Allowance": "Tunjangan Transport",
    "Meal Allowance": "Tunjangan Makan",
    "Position Allowance": "Tunjangan Jabatan",
    "BPJS Health": "BPJS Kesehatan",
    "BPJS JHT": "BPJS JHT",
    "BPJS JP": "BPJS JP",
    "Income Tax (PPh 21)": "PPh 21",
  },
  attendanceLabel: {
    Present: "Hadir",
    Late: "Telat",
    "On Leave": "Cuti",
    Absent: "Absen",
    "Not Checked In": "Belum absen",
  },
  department: {
    Finance: "Keuangan",
    "People Operations": "People Ops",
  },
  designation: {
    "Finance Staff": "Staf Keuangan",
    "Finance Manager": "Manajer Keuangan",
    "HR Staff": "Staf HR",
  },
  shift: {
    "Morning Shift": "Shift Pagi",
  },
  relation: {
    Mother: "Ibu",
    Father: "Ayah",
    Sibling: "Saudara",
    Spouse: "Pasangan",
    Friend: "Teman",
    Other: "Lainnya",
  },
} as const;

export type KategoriLabel = keyof typeof ID;

export function terjemahkan(kategori: KategoriLabel, nilai: string): string {
  // Server berbahasa Inggris, jadi mode English menampilkan nilainya apa adanya.
  if (bahasaAktif() === "en") return nilai;
  const tabel = ID[kategori] as Record<string, string>;
  return tabel[nilai] ?? nilai;
}

// Arah sebaliknya, untuk nilai yang dikirim kembali ke server (mis. hubungan
// kontak darurat yang dipilih pengguna dalam bahasa Indonesia).
export function kembalikan(kategori: KategoriLabel, tampilan: string): string {
  const tabel = ID[kategori] as Record<string, string>;
  const ketemu = Object.entries(tabel).find(([, v]) => v === tampilan);
  return ketemu ? ketemu[0] : tampilan;
}
