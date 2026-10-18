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
import { translate } from "@/i18n";
import type { Kunci } from "@/i18n/id";

// Label dibaca saat dipakai (bukan saat modul dimuat) supaya mengikuti bahasa aktif.
function localizeLabels<K extends string>(
  labelMap: Record<K, Kunci>,
): Record<K, string> {
  const result = {} as Record<K, string>;
  for (const k of Object.keys(labelMap) as K[]) {
    Object.defineProperty(result, k, {
      enumerable: true,
      get: () => translate(labelMap[k]),
    });
  }
  return result;
}

export function leaveDecisionBadge(decision: LeaveDecision): {
  label: string;
  tone: SemanticTone;
} {
  if (decision === "approve")
    return { label: translate("st.disetujui"), tone: "ok" };
  if (decision === "reject")
    return { label: translate("st.ditolak"), tone: "bad" };
  return { label: translate("st.menunggu"), tone: "warn" };
}

export const ATTENDANCE_STATUS_LABEL = localizeLabels<AttendanceStatus>({
  hadir: "st.hadir",
  telat: "st.telat",
  izin: "st.izin",
});

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, SemanticTone> = {
  hadir: "ok",
  telat: "warn",
  izin: "info",
};

export const CORRECTION_STATUS_LABEL =
  localizeLabels<AttendanceRequestedStatus>({
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

export const LEAVE_TYPE_LABEL = localizeLabels<LeaveType>({
  cuti: "jenis.cuti",
  lembur: "jenis.lembur",
  dinas_luar: "jenis.dinas",
  sakit: "jenis.sakit",
  wfh: "jenis.wfh",
});

export const LEAVE_TYPE_TONE: Record<LeaveType, SemanticTone> = {
  cuti: "info",
  lembur: "warn",
  dinas_luar: "info",
  sakit: "bad",
  wfh: "info",
};

export const OVERTIME_STATUS_LABEL = localizeLabels<OvertimeStatus>({
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

export const DOC_STATUS_LABEL = localizeLabels<DocStatus>({
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

export const DOC_CATEGORY_LABEL = localizeLabels<DocCategory>({
  kontrak: "dok.kontrak",
  sk: "dok.sk",
  sertifikat: "dok.sertifikat",
  identitas: "dok.identitas",
});
