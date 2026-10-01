import { SemanticTone } from "@/theme/colors";

export interface SyaratPassword {
  label: string;
  ok: boolean;
}

/** Satu-satunya definisi syarat password. */
export function syaratPassword(pw: string): SyaratPassword[] {
  return [
    { label: "Minimal 8 karakter", ok: pw.length >= 8 },
    { label: "Mengandung huruf besar", ok: /[A-Z]/.test(pw) },
    { label: "Mengandung angka", ok: /\d/.test(pw) },
    { label: "Mengandung simbol", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export const TOTAL_SYARAT = 4;

export function skorPassword(pw: string) {
  return syaratPassword(pw).filter((s) => s.ok).length;
}

export function labelKekuatan(pw: string) {
  if (!pw) return "Belum diisi";
  return ["", "Lemah", "Cukup", "Kuat", "Sangat kuat"][
    Math.max(skorPassword(pw), 1)
  ];
}

export function toneKekuatan(pw: string): SemanticTone {
  const s = skorPassword(pw);
  if (s <= 1) return "bad";
  if (s === 2) return "warn";
  if (s === 3) return "info";
  return "ok";
}
