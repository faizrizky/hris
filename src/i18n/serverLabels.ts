// ERPNext dibuat berbahasa Inggris supaya data dan Server Script netral bahasa.
// Semua terjemahan ke Indonesia untuk teks yang datang dari server ada di
// file ini, jadi menambah bahasa lain cukup di satu tempat. Nilai yang tidak
// dikenal (mis. nama departemen baru) ditampilkan apa adanya.

import { getActiveLanguage } from "./index";
import { formatShortDateWithYear } from "@/utils/date";
import { rupiah } from "@/utils/currency";

const ID = {
  leaveType: {
    "Annual Leave": "Cuti Tahunan",
    "Sick Leave": "Cuti Sakit",
    "Maternity Leave": "Cuti Melahirkan",
    "Marriage Leave": "Izin Menikah",
    "Child Marriage Leave": "Izin Menikahkan Anak",
    "Child Circumcision or Baptism Leave": "Izin Khitan atau Baptis Anak",
    "Spouse Childbirth Leave": "Izin Istri Melahirkan atau Keguguran",
    "Bereavement Leave - Immediate Family": "Izin Keluarga Inti Meninggal",
    "Bereavement Leave - Household Member": "Izin Anggota Serumah Meninggal",
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

export type LabelCategory = keyof typeof ID;

export function translateServerLabel(
  category: LabelCategory,
  value: string,
): string {
  // Server berbahasa Inggris, jadi mode English menampilkan nilainya apa adanya.
  if (getActiveLanguage() === "en") return value;
  const table = ID[category] as Record<string, string>;
  return table[value] ?? value;
}

// Arah sebaliknya, untuk nilai yang dikirim kembali ke server (mis. hubungan
// kontak darurat yang dipilih pengguna dalam bahasa Indonesia).
export function toServerValue(
  category: LabelCategory,
  displayText: string,
): string {
  const table = ID[category] as Record<string, string>;
  const foundEntry = Object.entries(table).find(([, v]) => v === displayText);
  return foundEntry ? foundEntry[0] : displayText;
}

const MONTHS_ID: Record<string, string> = {
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
export function translateNotification(
  subject: string,
  body: string,
): { title: string; body: string } {
  if (getActiveLanguage() === "en") return { title: subject, body };

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
    title = `Slip gaji ${MONTHS_ID[m[1]!] ?? m[1]} ${m[2]} tersedia`;
  } else if (subject === "Your attendance correction was approved") {
    title = "Koreksi absensimu disetujui";
  } else if (subject === "Your attendance correction was rejected") {
    title = "Koreksi absensimu ditolak";
  }

  const fixed: Record<string, string> = {
    "Your shift request was approved": "Pengajuan sifmu disetujui",
    "Your shift request was rejected": "Pengajuan sifmu ditolak",
    "Your leave encashment was approved": "Pencairan cutimu disetujui",
    "Your promotion has been recorded": "Promosimu sudah dicatat",
    "Your separation process has started":
      "Proses pemberhentianmu sudah dimulai",
    "Your exit interview is scheduled": "Exit interview-mu sudah dijadwalkan",
    "A new grievance is waiting for review": "Pengaduan baru menunggu ditinjau",
    "Your grievance is now open": "Pengaduanmu dibuka kembali",
    "Your grievance is now investigated": "Pengaduanmu sedang diselidiki",
    "Your grievance is now resolved": "Pengaduanmu sudah diselesaikan",
    "Your grievance is now invalid": "Pengaduanmu dinyatakan tidak valid",
    "Your grievance is now cancelled": "Pengaduanmu dibatalkan",
  };
  if (fixed[subject]) title = fixed[subject];
  else if (
    (m = subject.match(
      /^Shift request from (.+) is waiting for your approval$/,
    ))
  ) {
    title = `Pengajuan sif ${m[1]} menunggu persetujuanmu`;
  } else if (
    (m = subject.match(/^Leave encashment from (.+) is waiting for review$/))
  ) {
    title = `Pencairan cuti ${m[1]} menunggu ditinjau`;
  } else if ((m = subject.match(/^You are enrolled in training: (.+)$/))) {
    title = `Kamu terdaftar di pelatihan: ${m[1]}`;
  } else if ((m = subject.match(/^(.+) assigned you a task: (.+)$/))) {
    title = `Tugas baru dari ${m[1]}: ${m[2]}`;
  }

  let content = body;
  const leave = body.match(/^(Annual Leave|Sick Leave): (\S+) to (\S+)$/);
  if (leave) {
    const tgl = (iso: string) => formatShortDateWithYear(iso);
    content = `${translateServerLabel("leaveType", leave[1]!)}: ${
      leave[2] === leave[3]
        ? tgl(leave[2]!)
        : `${tgl(leave[2]!)} – ${tgl(leave[3]!)}`
    }`;
  }
  const salary = body.match(/^Net pay: ([\d.]+)$/);
  if (salary) content = `Take home ${rupiah(Number(salary[1]))}`;
  return { title, body: content };
}
