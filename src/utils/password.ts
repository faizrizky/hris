import { SemanticTone } from "@/theme/colors";
import { translate } from "@/i18n";

export interface PasswordRequirement {
  label: string;
  ok: boolean;
}

/** Satu-satunya definisi syarat password. */
export function getPasswordRequirements(pw: string): PasswordRequirement[] {
  return [
    { label: translate("pw.min8"), ok: pw.length >= 8 },
    { label: translate("pw.besar"), ok: /[A-Z]/.test(pw) },
    { label: translate("pw.angka"), ok: /\d/.test(pw) },
    { label: translate("pw.simbol"), ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export const TOTAL_REQUIREMENTS = 4;

export function scorePassword(pw: string) {
  return getPasswordRequirements(pw).filter((s) => s.ok).length;
}

export function getStrengthLabel(pw: string) {
  if (!pw) return translate("pw.kosong");
  return translate(
    (["pw.lemah", "pw.lemah", "pw.cukup", "pw.kuat", "pw.sangatKuat"] as const)[
      Math.max(scorePassword(pw), 1)
    ],
  );
}

export function getStrengthTone(pw: string): SemanticTone {
  const s = scorePassword(pw);
  if (s <= 1) return "bad";
  if (s === 2) return "warn";
  if (s === 3) return "info";
  return "ok";
}
