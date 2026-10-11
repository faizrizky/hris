// ERPNext dibuat berbahasa Inggris supaya data dan Server Script netral bahasa.
// Semua terjemahan ke Indonesia untuk teks yang datang dari server ada di
// file ini, jadi menambah bahasa lain cukup di satu tempat. Nilai yang tidak
// dikenal (mis. nama departemen baru) ditampilkan apa adanya.

import { bahasaAktif } from "./index";
import { tanggalPendekTahun } from "@/utils/date";
import { rupiah } from "@/utils/currency";

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
    Child: "Anak",
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

const BULAN_ID: Record<string, string> = {
  January: "Januari",
  February: "Februari",
  March: "Maret",
  April: "April",
  May: "Mei",
  June: "Juni",
  July: "Juli",
  August: "Agustus",
  September: "September",
  October: "Oktober",
  November: "November",
  December: "Desember",
};

// Teks notifikasi dari server berbahasa Inggris dan berpola tetap, jadi
// diterjemahkan dengan pola. Yang tidak dikenal ditampilkan apa adanya.
export function terjemahkanNotifikasi(
  subject: string,
  body: string,
): { title: string; body: string } {
  if (bahasaAktif() === "en") return { title: subject, body };

  let title = subject;
  let m: RegExpMatchArray | null;
  if (
    (m = subject.match(
      /^Leave request from (.+) is waiting for your approval$/,
    ))
  ) {
    title = `Pengajuan cuti ${m[1]} menunggu persetujuanmu`;
  } else if (subject === "Your leave request was approved") {
    title = "Pengajuan cutimu disetujui";
  } else if (subject === "Your leave request was rejected") {
    title = "Pengajuan cutimu ditolak";
  } else if ((m = subject.match(/^Your (\w+) (\d{4}) payslip is available$/))) {
    title = `Slip gaji ${BULAN_ID[m[1]!] ?? m[1]} ${m[2]} tersedia`;
  } else if (subject === "Your attendance correction was approved") {
    title = "Koreksi absensimu disetujui";
  } else if (subject === "Your attendance correction was rejected") {
    title = "Koreksi absensimu ditolak";
  }

  let isi = body;
  const cuti = body.match(/^(Annual Leave|Sick Leave): (\S+) to (\S+)$/);
  if (cuti) {
    const tgl = (iso: string) => tanggalPendekTahun(iso);
    isi = `${terjemahkan("leaveType", cuti[1]!)}: ${
      cuti[2] === cuti[3]
        ? tgl(cuti[2]!)
        : `${tgl(cuti[2]!)} – ${tgl(cuti[3]!)}`
    }`;
  }
  const gaji = body.match(/^Net pay: ([\d.]+)$/);
  if (gaji) isi = `Take home ${rupiah(Number(gaji[1]))}`;
  return { title, body: isi };
}
