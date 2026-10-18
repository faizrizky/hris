import type { ClockState } from "@/services/types";
import { translate } from "@/i18n";

// Sapaan di Beranda menyesuaikan jam sekarang dan shift kerja karyawan (dari server):
// belum waktunya, waktunya clock in, terlambat, sedang kerja, waktunya clock out, atau sudah selesai.

export type Greeting = "pagi" | "siang" | "sore" | "malam";

export function getGreetingKind(jam: number): Greeting {
  if (jam < 11) return "pagi";
  if (jam < 15) return "siang";
  if (jam < 18) return "sore";
  return "malam";
}

export function minutesOf(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : null;
}

const dot = (hhmm: string) => hhmm.replace(":", ".");

export function employeeGreeting(clock: ClockState | null, now: Date): string {
  const greeting = translate(
    `hm.salam.${getGreetingKind(now.getHours())}` as never,
  );
  let currentTime = now.getHours() * 60 + now.getMinutes();
  const mulai = minutesOf(clock?.shiftStart);
  let shiftEndMinutes = minutesOf(clock?.shiftEnd);
  // Shift malam yang melewati tengah malam (selesai lebih kecil dari mulai): selesai jatuh keesokan harinya.
  if (mulai !== null && shiftEndMinutes !== null && shiftEndMinutes <= mulai)
    shiftEndMinutes += 24 * 60;
  const p = {
    greeting,
    mulai: clock?.shiftStart ? dot(clock.shiftStart) : "",
    selesai: clock?.shiftEnd ? dot(clock.shiftEnd) : "",
  };

  // Dini hari saat shift malam kemarin masih berjalan: hitung jam sekarang sebagai lanjutan hari kemarin.
  if (
    mulai !== null &&
    shiftEndMinutes !== null &&
    shiftEndMinutes > 24 * 60 &&
    currentTime < shiftEndMinutes - 24 * 60
  ) {
    currentTime += 24 * 60;
  }

  if (!clock) return translate("hm.sapaEss", p as never);
  if (clock.lastCheckIn && clock.lastCheckOut && !clock.clockedIn) {
    return translate("hm.selesaiHari", p as never);
  }
  if (clock.clockedIn) {
    return shiftEndMinutes !== null && currentTime >= shiftEndMinutes
      ? translate("hm.lupaOut", p as never)
      : translate("hm.sedangKerja", p as never);
  }
  if (mulai === null) return translate("hm.sapaEss", p as never);
  if (currentTime < mulai - 60) return translate("hm.belumMulai", p as never);
  if (currentTime <= mulai + 15) return translate("hm.ingatIn", p as never);
  if (shiftEndMinutes === null || currentTime < shiftEndMinutes)
    return translate("hm.telatIn", p as never);
  return translate("hm.tanpaAbsen", p as never);
}

export function getShiftInfo(clock: ClockState | null, lokasi: string): string {
  if (!clock?.shiftStart || !clock.shiftEnd) return translate("hm.shift");
  return translate("hm.shiftInfo", {
    mulai: dot(clock.shiftStart),
    selesai: dot(clock.shiftEnd),
    lokasi,
  } as never);
}
