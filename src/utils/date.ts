import { bahasaAktif } from "@/i18n";

const HARI_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const HARI_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const BULAN_EN = [
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
const BULAN_ID = [
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
const hariAktif = () => (bahasaAktif() === "en" ? HARI_EN : HARI_ID);
const bulanAktif = () => (bahasaAktif() === "en" ? BULAN_EN : BULAN_ID);

export function formatTanggalPanjang(d: Date = new Date()) {
  return `${hariAktif()[d.getDay()]}, ${d.getDate()} ${bulanAktif()[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-09-18" -> "18 Sep" */
export function tanggalPendek(iso: string) {
  const d = fromISODate(iso);
  return `${d.getDate()} ${bulanAktif()[d.getMonth()].slice(0, 3)}`;
}

/** "2026-09-12" -> "12 Sep 2026" */
export function tanggalPendekTahun(iso: string) {
  return `${tanggalPendek(iso)} ${fromISODate(iso).getFullYear()}`;
}

export function formatJam(d: Date = new Date()) {
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `${jam}:${menit}`;
}

/** 1020 -> "17:00" */
export function jamMenit(menit: number) {
  const h = String(Math.floor(menit / 60)).padStart(2, "0");
  const m = String(menit % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// "08:02" -> 482. Kebalikan dari jamMenit().
export function menitDari(jam: string) {
  const [h, m] = jam.split(":").map(Number);
  return h * 60 + m;
}

/** 2.5 -> "2j 30m" */
export function durasiJam(jam: number) {
  const h = Math.floor(jam);
  const m = Math.round((jam % 1) * 60);
  const j = bahasaAktif() === "en" ? "h" : "j";
  return `${h}${j} ${String(m).padStart(2, "0")}m`;
}

/** 4 -> "4j", 0.5 -> "30m", 2.5 -> "2j30m" — untuk chip sempit */
export function durasiSingkat(jam: number) {
  const h = Math.floor(jam);
  const m = Math.round((jam % 1) * 60);
  const j = bahasaAktif() === "en" ? "h" : "j";
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
export function namaHari(iso: string) {
  return hariAktif()[fromISODate(iso).getDay()];
}

/** "14" */
export function tanggalAngka(iso: string) {
  return String(fromISODate(iso).getDate()).padStart(2, "0");
}

/** "SEP" */
export function bulanSingkat(iso: string) {
  return bulanAktif()[fromISODate(iso).getMonth()].slice(0, 3).toUpperCase();
}

/** Date -> "Sep 2026" */
export function labelBulan(d: Date) {
  return `${bulanAktif()[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** Date -> "September" */
export function namaBulan(d: Date = new Date()) {
  return bulanAktif()[d.getMonth()];
}

/** Jumlah hari kalender, inklusif kedua ujung */
export function hitungHari(startISO: string, endISO: string) {
  const ms = fromISODate(endISO).getTime() - fromISODate(startISO).getTime();
  return Math.round(ms / 86400000) + 1;
}

/** Jumlah hari kerja (Senin–Jumat), inklusif kedua ujung */
export function hitungHariKerja(startISO: string, endISO: string) {
  const d = fromISODate(startISO);
  const end = fromISODate(endISO);
  let n = 0;
  while (d <= end) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** "2023-09-14" -> 3 (tahun penuh) */
export function tahunSejak(iso: string) {
  const d = fromISODate(iso);
  const now = new Date();
  let tahun = now.getFullYear() - d.getFullYear();
  const belumUlangTahun =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  return Math.max(0, belumUlangTahun ? tahun - 1 : tahun);
}
