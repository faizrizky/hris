import { SemanticTone } from "@/theme/colors";
import { tt } from "@/i18n";

export interface SyaratPassword {
  label: string;
  ok: boolean;
}

/** Satu-satunya definisi syarat password. */
export function syaratPassword(pw: string): SyaratPassword[] {
  return [
    { label: tt("pw.min8"), ok: pw.length >= 8 },
    { label: tt("pw.besar"), ok: /[A-Z]/.test(pw) },
    { label: tt("pw.angka"), ok: /\d/.test(pw) },
    { label: tt("pw.simbol"), ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export const TOTAL_SYARAT = 4;

export function skorPassword(pw: string) {
  return syaratPassword(pw).filter((s) => s.ok).length;
}

export function labelKekuatan(pw: string) {
  if (!pw) return tt("pw.kosong");
  return tt(
    (["pw.lemah", "pw.lemah", "pw.cukup", "pw.kuat", "pw.sangatKuat"] as const)[
      Math.max(skorPassword(pw), 1)
    ],
  );
}

export function toneKekuatan(pw: string): SemanticTone {
  const s = skorPassword(pw);
  if (s <= 1) return "bad";
  if (s === 2) return "warn";
  if (s === 3) return "info";
  return "ok";
}
