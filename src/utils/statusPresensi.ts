import type { ClockState } from "@/services/types";

const menit = (hhmm: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export type HasilStatus =
  | { jenis: "tepat" }
  | { jenis: "terlambat"; menit: number }
  | { jenis: "pulangAwal"; menit: number };

// Selisih menit pada jam dinding, dinormalisasi ke rentang -12 jam sampai +12 jam (agar 00:10 vs 22:00 berselisih 130 menit).
const selisih = (a: number, b: number) =>
  ((((a - b) % 1440) + 2160) % 1440) - 720;

// Status presensi dibandingkan dengan shift hari itu (toleransi dari Shift Type di server).
// Clock In setelah jam mulai + toleransi = terlambat; Clock Out sebelum jam selesai - toleransi = pulang lebih awal.
// Shift yang melewati tengah malam (selesai <= mulai) dinilai dengan selisih jam dinding dalam batas 12 jam.
export function statusPresensi(
  aksi: "IN" | "OUT",
  jam: string | null,
  s: ClockState,
): HasilStatus {
  const j = menit(jam);
  const mulai = menit(s.shiftStart);
  const selesai = menit(s.shiftEnd);
  if (j === null || mulai === null || selesai === null)
    return { jenis: "tepat" };
  const malam = selesai <= mulai;
  if (aksi === "IN") {
    const telat = malam ? selisih(j, mulai) : j - mulai;
    return telat > (s.lateGraceMin ?? 0)
      ? { jenis: "terlambat", menit: telat }
      : { jenis: "tepat" };
  }
  const awal = malam ? selisih(selesai, j) : selesai - j;
  return awal > (s.earlyGraceMin ?? 0)
    ? { jenis: "pulangAwal", menit: awal }
    : { jenis: "tepat" };
}
