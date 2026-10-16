import type { ClockState } from "@/services/types";

const menit = (hhmm: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export type HasilStatus =
  | { jenis: "tepat" }
  | { jenis: "terlambat"; menit: number }
  | { jenis: "pulangAwal"; menit: number };

// Status presensi dibandingkan dengan shift hari itu (toleransi dari Shift Type di server).
// Clock In setelah jam mulai + toleransi = terlambat; Clock Out sebelum jam selesai - toleransi = pulang lebih awal.
// Shift lintas tengah malam tidak dinilai (jam di hari berbeda), jadi dianggap tepat.
export function statusPresensi(
  aksi: "IN" | "OUT",
  jam: string | null,
  s: ClockState,
): HasilStatus {
  const j = menit(jam);
  const mulai = menit(s.shiftStart);
  const selesai = menit(s.shiftEnd);
  if (j === null || mulai === null || selesai === null || selesai <= mulai)
    return { jenis: "tepat" };
  if (aksi === "IN") {
    const lewat = j - (mulai + (s.lateGraceMin ?? 0));
    return lewat > 0
      ? { jenis: "terlambat", menit: j - mulai }
      : { jenis: "tepat" };
  }
  const awal = selesai - (s.earlyGraceMin ?? 0) - j;
  return awal > 0
    ? { jenis: "pulangAwal", menit: selesai - j }
    : { jenis: "tepat" };
}
