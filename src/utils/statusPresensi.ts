import type { ClockState } from "@/services/types";
import { translate } from "@/i18n";

const minutes = (hhmm: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export type StatusResult =
  | { kind: "tepat" }
  | { kind: "terlambat"; minutes: number }
  | { kind: "pulangAwal"; minutes: number };

// Selisih menit pada jam dinding, dinormalisasi ke rentang -12 jam sampai +12 jam (agar 00:10 vs 22:00 berselisih 130 menit).
const difference = (a: number, b: number) =>
  ((((a - b) % 1440) + 2160) % 1440) - 720;

// Status presensi dibandingkan dengan shift hari itu (toleransi dari Shift Type di server).
// Clock In setelah jam mulai + toleransi = terlambat; Clock Out sebelum jam selesai - toleransi = pulang lebih awal.
// Shift yang melewati tengah malam (selesai <= mulai) dinilai dengan selisih jam dinding dalam batas 12 jam.
export function getAttendanceStatus(
  action: "IN" | "OUT",
  jam: string | null,
  s: ClockState,
): StatusResult {
  const j = minutes(jam);
  const mulai = minutes(s.shiftStart);
  const shiftEndMinutes = minutes(s.shiftEnd);
  if (j === null || mulai === null || shiftEndMinutes === null)
    return { kind: "tepat" };
  const isNightShift = shiftEndMinutes <= mulai;
  if (action === "IN") {
    const lateMinutes = isNightShift ? difference(j, mulai) : j - mulai;
    return lateMinutes > (s.lateGraceMin ?? 0)
      ? { kind: "terlambat", minutes: lateMinutes }
      : { kind: "tepat" };
  }
  const initial = isNightShift
    ? difference(shiftEndMinutes, j)
    : shiftEndMinutes - j;
  return initial > (s.earlyGraceMin ?? 0)
    ? { kind: "pulangAwal", minutes: initial }
    : { kind: "tepat" };
}

// Durasi ringkas tanpa detik: di bawah 60 menit "45 mnt"; mulai 60 menit "9 jam 10 mnt" (menit 0 dihilangkan).
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} ${translate("dur.mnt")}`;
  const j = Math.floor(m / 60);
  const remainder = m % 60;
  return remainder === 0
    ? `${j} ${translate("dur.jam")}`
    : `${j} ${translate("dur.jam")} ${remainder} ${translate("dur.mnt")}`;
}
