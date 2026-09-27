import { AttendanceStatus, AttendanceRequestedStatus } from "@/services/types";
import { SemanticTone } from "@/theme/colors";
import { LeaveType } from "@/services/types";
import { LeaveDecision } from "@/services/types";

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
