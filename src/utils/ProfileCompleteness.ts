import { EditableProfile } from "@/services/types";
import { translate } from "@/i18n";

export interface Shortcoming {
  title: string;
  reason: string;
}

export function isValidEmail(v: string) {
  return /^\S+@\S+\.\S+$/.test(v.trim());
}

export function isValidPhone(v: string) {
  return v.replace(/\D/g, "").length >= 8;
}

/** Satu-satunya tempat yang tahu apa saja yang kurang. */
export function findShortcomings(e: EditableProfile): Shortcoming[] {
  const out: Shortcoming[] = [];
  if (!isValidEmail(e.personalEmail))
    out.push({
      title: translate("kl.email"),
      reason: translate("kl.emailAlasan"),
    });
  if (!e.contacts.some((k) => k.name.trim() && isValidPhone(k.phone)))
    out.push({
      title: translate("kl.kontak2"),
      reason: translate("kl.kontak2Alasan"),
    });
  return out;
}

// 72% sudah terisi HR dan tidak bisa diubah karyawan; sisanya dua item di atas.
const BASE_FIELDS = 72;
const PER_ITEM = 14;
export const TOTAL_ITEM = 2;

export function completenessPercent(e: EditableProfile) {
  return BASE_FIELDS + (TOTAL_ITEM - findShortcomings(e).length) * PER_ITEM;
}

export function initialsOf(nama: string) {
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
