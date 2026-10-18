import type { ClockState } from "@/services/types";
import { translate } from "@/i18n";

// Sapaan di Beranda menyesuaikan jam sekarang dan shift kerja karyawan (dari server):
// belum waktunya, waktunya clock in, terlambat, sedang kerja, waktunya clock out, atau sudah selesai.

export type Greeting = "pagi" | "siang" | "sore" | "malam";

export function getGreetingKind(hour: number): Greeting {
  if (hour < 11) return "pagi";
  if (hour < 15) return "siang";
  if (hour < 18) return "sore";
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
  const shiftStartMinutes = minutesOf(clock?.shiftStart);
  let shiftEndMinutes = minutesOf(clock?.shiftEnd);
  // Shift malam yang melewati tengah malam (selesai lebih kecil dari shiftStartMinutes): selesai jatuh keesokan harinya.
  if (
    shiftStartMinutes !== null &&
    shiftEndMinutes !== null &&
    shiftEndMinutes <= shiftStartMinutes
  )
    shiftEndMinutes += 24 * 60;
  const p = {
    salam: greeting,
    mulai: clock?.shiftStart ? dot(clock.shiftStart) : "",
    selesai: clock?.shiftEnd ? dot(clock.shiftEnd) : "",
  };

  // Dini hari saat shift malam kemarin masih berjalan: hitung jam sekarang sebagai lanjutan hari kemarin.
  if (
    shiftStartMinutes !== null &&
    shiftEndMinutes !== null &&
    shiftEndMinutes > 24 * 60 &&
    currentTime < shiftEndMinutes - 24 * 60
  ) {
    currentTime += 24 * 60;
  }

  if (!clock) return translate("hm.sapaEss", p);
  if (clock.lastCheckIn && clock.lastCheckOut && !clock.clockedIn) {
    return translate("hm.selesaiHari", p);
  }
  if (clock.clockedIn) {
    return shiftEndMinutes !== null && currentTime >= shiftEndMinutes
      ? translate("hm.lupaOut", p)
      : translate("hm.sedangKerja", p);
  }
  if (shiftStartMinutes === null) return translate("hm.sapaEss", p);
  if (currentTime < shiftStartMinutes - 60)
    return translate("hm.belumMulai", p);
  if (currentTime <= shiftStartMinutes + 15) return translate("hm.ingatIn", p);
  if (shiftEndMinutes === null || currentTime < shiftEndMinutes)
    return translate("hm.telatIn", p);
  return translate("hm.tanpaAbsen", p);
}

export function getShiftInfo(
  clock: ClockState | null,
  locationName: string,
): string {
  if (!clock?.shiftStart || !clock.shiftEnd) return translate("hm.shift");
  return translate("hm.shiftInfo", {
    mulai: dot(clock.shiftStart),
    selesai: dot(clock.shiftEnd),
    lokasi: locationName,
  });
}
