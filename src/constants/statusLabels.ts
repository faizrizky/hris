import {
  AttendanceStatus,
  AttendanceRequestedStatus,
  LeaveType,
  LeaveDecision,
  OvertimeStatus,
  DocCategory,
  DocStatus,
} from "@/services/types";
import { SemanticTone } from "@/theme/colors";
import { tt } from "@/i18n";
import type { Kunci } from "@/i18n/id";

// Label dibaca saat dipakai (bukan saat modul dimuat) supaya mengikuti bahasa aktif.
function labelBahasa<K extends string>(
  peta: Record<K, Kunci>,
): Record<K, string> {
  const hasil = {} as Record<K, string>;
  for (const k of Object.keys(peta) as K[]) {
    Object.defineProperty(hasil, k, {
      enumerable: true,
      get: () => tt(peta[k]),
    });
  }
  return hasil;
}

export function leaveDecisionBadge(decision: LeaveDecision): {
  label: string;
  tone: SemanticTone;
} {
  if (decision === "approve") return { label: tt("st.disetujui"), tone: "ok" };
  if (decision === "reject") return { label: tt("st.ditolak"), tone: "bad" };
  return { label: tt("st.menunggu"), tone: "warn" };
}

export const ATTENDANCE_STATUS_LABEL = labelBahasa<AttendanceStatus>({
  hadir: "st.hadir",
  telat: "st.telat",
  izin: "st.izin",
});

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, SemanticTone> = {
  hadir: "ok",
  telat: "warn",
  izin: "info",
};

export const CORRECTION_STATUS_LABEL = labelBahasa<AttendanceRequestedStatus>({
  pending: "st.menunggu",
  approved: "st.disetujui",
  rejected: "st.ditolak",
});

export const CORRECTION_STATUS_TONE: Record<
  AttendanceRequestedStatus,
  SemanticTone
> = {
  pending: "warn",
  approved: "ok",
  rejected: "bad",
};

export const LEAVE_TYPE_LABEL = labelBahasa<LeaveType>({
  cuti: "jenis.cuti",
  lembur: "jenis.lembur",
  dinas_luar: "jenis.dinas",
  sakit: "jenis.sakit",
});

export const LEAVE_TYPE_TONE: Record<LeaveType, SemanticTone> = {
  cuti: "info",
  lembur: "warn",
  dinas_luar: "info",
  sakit: "bad",
};

export const OVERTIME_STATUS_LABEL = labelBahasa<OvertimeStatus>({
  pending: "st.menunggu",
  approved: "st.disetujui",
  paid: "st.dibayar",
  rejected: "st.ditolak",
});

export const OVERTIME_STATUS_TONE: Record<OvertimeStatus, SemanticTone> = {
  pending: "warn",
  approved: "ok",
  paid: "info",
  rejected: "bad",
};

export const DOC_STATUS_LABEL = labelBahasa<DocStatus>({
  verified: "st.terverifikasi",
  pending: "st.menungguVerifikasi",
  expiring: "st.segeraBerakhir",
  rejected: "st.ditolak",
  changeRequested: "st.perubahanDiminta",
});

export const DOC_STATUS_TONE: Record<DocStatus, SemanticTone> = {
  verified: "ok",
  pending: "warn",
  expiring: "warn",
  rejected: "bad",
  changeRequested: "info",
};

export const DOC_CATEGORY_LABEL = labelBahasa<DocCategory>({
  kontrak: "dok.kontrak",
  sk: "dok.sk",
  sertifikat: "dok.sertifikat",
  identitas: "dok.identitas",
});
