import { AttendanceStatus, AttendanceRequestedStatus } from "@/services/types";
import { SemanticTone } from "@/theme/colors";

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
