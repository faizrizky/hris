import type { ClockState } from "@/services/types";
import { tt } from "@/i18n";

// Sapaan di Beranda menyesuaikan jam sekarang dan shift kerja karyawan (dari server):
// belum waktunya, waktunya clock in, terlambat, sedang kerja, waktunya clock out, atau sudah selesai.

export type Salam = "pagi" | "siang" | "sore" | "malam";

export function jenisSalam(jam: number): Salam {
  if (jam < 11) return "pagi";
  if (jam < 15) return "siang";
  if (jam < 18) return "sore";
  return "malam";
}

export function menitDari(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : null;
}

const titik = (hhmm: string) => hhmm.replace(":", ".");

export function sapaanKaryawan(clock: ClockState | null, now: Date): string {
  const salam = tt(`hm.salam.${jenisSalam(now.getHours())}` as never);
  const sekarang = now.getHours() * 60 + now.getMinutes();
  const mulai = menitDari(clock?.shiftStart);
  const selesai = menitDari(clock?.shiftEnd);
  const p = {
    salam,
    mulai: clock?.shiftStart ? titik(clock.shiftStart) : "",
    selesai: clock?.shiftEnd ? titik(clock.shiftEnd) : "",
  };

  if (!clock) return tt("hm.sapaEss", p as never);
  if (clock.lastCheckIn && clock.lastCheckOut && !clock.clockedIn) {
    return tt("hm.selesaiHari", p as never);
  }
  if (clock.clockedIn) {
    return selesai !== null && sekarang >= selesai
      ? tt("hm.lupaOut", p as never)
      : tt("hm.sedangKerja", p as never);
  }
  if (mulai === null) return tt("hm.sapaEss", p as never);
  if (sekarang < mulai - 60) return tt("hm.belumMulai", p as never);
  if (sekarang <= mulai + 15) return tt("hm.ingatIn", p as never);
  if (selesai === null || sekarang < selesai)
    return tt("hm.telatIn", p as never);
  return tt("hm.tanpaAbsen", p as never);
}

export function infoShift(clock: ClockState | null, lokasi: string): string {
  if (!clock?.shiftStart || !clock.shiftEnd) return tt("hm.shift");
  return tt("hm.shiftInfo", {
    mulai: titik(clock.shiftStart),
    selesai: titik(clock.shiftEnd),
    lokasi,
  } as never);
}
