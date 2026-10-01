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

export function leaveDecisionBadge(decision: LeaveDecision): {
  label: string;
  tone: SemanticTone;
} {
  if (decision === "approve") return { label: "Disetujui", tone: "ok" };
  if (decision === "reject") return { label: "Ditolak", tone: "bad" };
  return { label: "Menunggu", tone: "warn" };
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: "Hadir",
  telat: "Telat",
  izin: "Izin",
};

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, SemanticTone> = {
  hadir: "ok",
  telat: "warn",
  izin: "info",
};

export const CORRECTION_STATUS_LABEL: Record<
  AttendanceRequestedStatus,
  string
> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export const CORRECTION_STATUS_TONE: Record<
  AttendanceRequestedStatus,
  SemanticTone
> = {
  pending: "warn",
  approved: "ok",
  rejected: "bad",
};

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  cuti: "Cuti",
  lembur: "Lembur",
  dinas_luar: "Dinas luar",
  sakit: "Sakit",
};

export const LEAVE_TYPE_TONE: Record<LeaveType, SemanticTone> = {
  cuti: "info",
  lembur: "warn",
  dinas_luar: "info",
  sakit: "bad",
};

export const OVERTIME_STATUS_LABEL: Record<OvertimeStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Dibayar",
  rejected: "Ditolak",
};

export const OVERTIME_STATUS_TONE: Record<OvertimeStatus, SemanticTone> = {
  pending: "warn",
  approved: "ok",
  paid: "info",
  rejected: "bad",
};

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  verified: "Terverifikasi",
  pending: "Menunggu verifikasi",
  expiring: "Segera berakhir",
};

export const DOC_STATUS_TONE: Record<DocStatus, SemanticTone> = {
  verified: "ok",
  pending: "warn",
  expiring: "warn",
};

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  kontrak: "Kontrak",
  sk: "SK",
  sertifikat: "Sertifikat",
  identitas: "Identitas",
};
