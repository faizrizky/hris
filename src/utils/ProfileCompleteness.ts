import { EditableProfile } from "@/services/types";

export interface Kekurangan {
  judul: string;
  alasan: string;
}

export function emailValid(v: string) {
  return /^\S+@\S+\.\S+$/.test(v.trim());
}

export function teleponValid(v: string) {
  return v.replace(/\D/g, "").length >= 8;
}

/** Satu-satunya tempat yang tahu apa saja yang kurang. */
export function kekurangan(e: EditableProfile): Kekurangan[] {
  const out: Kekurangan[] = [];
  if (!emailValid(e.personalEmail))
    out.push({
      judul: "Email pribadi",
      alasan: "Untuk pemulihan akun dan pengiriman slip gaji",
    });
  if (!teleponValid(e.em2Phone))
    out.push({
      judul: "Kontak darurat kedua",
      alasan: "Nama dan nomor telepon",
    });
  return out;
}

// 72% sudah terisi HR dan tidak bisa diubah karyawan; sisanya dua item di atas.
const DASAR = 72;
const PER_ITEM = 14;
export const TOTAL_ITEM = 2;

export function persenKelengkapan(e: EditableProfile) {
  return DASAR + (TOTAL_ITEM - kekurangan(e).length) * PER_ITEM;
}

export function inisial(nama: string) {
  return (
    nama
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}
