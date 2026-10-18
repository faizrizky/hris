import { getActiveLanguage } from "@/i18n";

const WEEKDAYS_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const WEEKDAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Nama hari/bulan dibaca saat dipanggil supaya mengikuti bahasa aktif.
const getActiveWeekdays = () =>
  getActiveLanguage() === "en" ? WEEKDAYS_EN : WEEKDAYS_ID;
const getActiveMonths = () =>
  getActiveLanguage() === "en" ? MONTHS_EN : MONTHS_ID;

export function formatLongDate(d: Date = new Date()) {
  return `${getActiveWeekdays()[d.getDay()]}, ${d.getDate()} ${getActiveMonths()[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-09-18" -> "18 Sep" */
export function formatShortDate(iso: string) {
  const d = fromISODate(iso);
  return `${d.getDate()} ${getActiveMonths()[d.getMonth()].slice(0, 3)}`;
}

/** "2026-09-12" -> "12 Sep 2026" */
export function formatShortDateWithYear(iso: string) {
  return `${formatShortDate(iso)} ${fromISODate(iso).getFullYear()}`;
}

export function formatJam(d: Date = new Date()) {
  const jam = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${jam}:${minutes}`;
}

/** 1020 -> "17:00" */
export function formatHoursMinutes(minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// "08:02" -> 482. Kebalikan dari jamMenit().
export function minutesOf(jam: string) {
  const [h, m] = jam.split(":").map(Number);
  return h * 60 + m;
}

/** 2.5 -> "2j 30m" */
export function formatHourDuration(jam: number) {
  const h = Math.floor(jam);
  const m = Math.round((jam % 1) * 60);
  const j = getActiveLanguage() === "en" ? "h" : "j";
  return `${h}${j} ${String(m).padStart(2, "0")}m`;
}

/** 4 -> "4j", 0.5 -> "30m", 2.5 -> "2j30m" — untuk chip sempit */
export function formatShortDuration(jam: number) {
  const h = Math.floor(jam);
  const m = Math.round((jam % 1) * 60);
  const j = getActiveLanguage() === "en" ? "h" : "j";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}${j}`;
  return `${h}${j}${m}m`;
}

/** "2026-09-14" -> Date lokal (tanpa geser timezone) */
export function fromISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> "2026-09-18" */
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "Senin" */
export function getWeekdayName(iso: string) {
  return getActiveWeekdays()[fromISODate(iso).getDay()];
}

/** "14" */
export function formatNumericDate(iso: string) {
  return String(fromISODate(iso).getDate()).padStart(2, "0");
}

/** "SEP" */
export function getShortMonth(iso: string) {
  return getActiveMonths()
    [fromISODate(iso).getMonth()].slice(0, 3)
    .toUpperCase();
}

/** Date -> "Sep 2026" */
export function getMonthLabel(d: Date) {
  return `${getActiveMonths()[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** Date -> "September" */
export function getMonthName(d: Date = new Date()) {
  return getActiveMonths()[d.getMonth()];
}

/** Jumlah hari kalender, inklusif kedua ujung */
export function countDays(startISO: string, endISO: string) {
  const ms = fromISODate(endISO).getTime() - fromISODate(startISO).getTime();
  return Math.round(ms / 86400000) + 1;
}

/** Jumlah hari kerja (Senin–Jumat), inklusif kedua ujung */
export function countWorkdays(startISO: string, endISO: string) {
  const d = fromISODate(startISO);
  const end = fromISODate(endISO);
  let n = 0;
  while (d <= end) {
    const weekday = d.getDay();
    if (weekday !== 0 && weekday !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** "2023-09-14" -> 3 (tahun penuh) */
export function yearsSince(iso: string) {
  const d = fromISODate(iso);
  const now = new Date();
  let year = now.getFullYear() - d.getFullYear();
  const hasNotHadAnniversary =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  return Math.max(0, hasNotHadAnniversary ? year - 1 : year);
}
