const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
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

export function formatTanggalPanjang(d: Date = new Date()) {
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatJam(d: Date = new Date()) {
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `${jam}:${menit}`;
}

/** "2026-09-14" -> Date lokal (tanpa geser timezone) */
export function fromISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Senin" */
export function namaHari(iso: string) {
  return HARI[fromISODate(iso).getDay()];
}

/** "14" */
export function tanggalAngka(iso: string) {
  return String(fromISODate(iso).getDate()).padStart(2, "0");
}

/** "SEP" */
export function bulanSingkat(iso: string) {
  return BULAN[fromISODate(iso).getMonth()].slice(0, 3).toUpperCase();
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
