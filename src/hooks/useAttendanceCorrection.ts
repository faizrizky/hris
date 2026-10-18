import { useEffect, useState } from "react";
import { joinReason } from "@/utils/correctionReason";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { AttendanceRecord, LeaveApprover } from "@/services/types";
import { ATTENDANCE_STATUS_LABEL } from "@/constants/statusLabels";
import { ApprovalStep } from "@/screens/leave/FormFlowCards";
import { ProofAttachment } from "@/screens/leave/OvertimeFormCards";
import {
  CorrectionKind,
  getCorrectionKindName,
} from "@/screens/attendance/CorrectionCards";
import {
  formatHoursMinutes,
  minutesOf,
  getWeekdayName,
  formatShortDate,
} from "@/utils/date";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { pickProof } from "@/utils/pickProof";

export const DEFAULT_CHECKIN_MINUTES = 8 * 60;

export const DEFAULT_CHECKOUT_MINUTES = 17 * 60;

export const CHECKIN_MIN_MINUTES = 5 * 60;

export const CHECKIN_MAX_MINUTES = 12 * 60;

export const CHECKOUT_MIN_MINUTES = 6 * 60;

export const CHECKOUT_MAX_MINUTES = 23 * 60 + 45;

export function useAttendanceCorrection() {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const [approver, setApprover] = useState<LeaveApprover | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editedCheckIn, setEditedCheckIn] = useState<number | null>(null);
  const [editedCheckOut, setEditedCheckOut] = useState<number | null>(null);
  const [kind, setKind] = useState<CorrectionKind>("Forgot check-in");
  const [reasonText, setReasonText] = useState("");
  const [files, setFiles] = useState<ProofAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!employee) return;
    hrisApi
      .getLeaveApprover(employee.id)
      .then(setApprover)
      .catch(() => setApprover(null));
    hrisApi
      .getAttendanceHistory(employee.id)
      .then(setHistory)
      // Riwayat hanya dipakai untuk mengisi jam awal; tanpa itu form tetap
      // bisa diisi manual, jadi galatnya tidak perlu ditampilkan.
      .catch(() => setHistory([]));
  }, [employee]);
  const record = selectedDate
    ? (history.find((r) => r.date === selectedDate) ?? null)
    : null;
  const checkInMinutes =
    editedCheckIn ??
    (record?.checkIn ? minutesOf(record.checkIn) : DEFAULT_CHECKIN_MINUTES);
  const checkOutMinutes =
    editedCheckOut ??
    (record?.checkOut ? minutesOf(record.checkOut) : DEFAULT_CHECKOUT_MINUTES);
  const setCheckIn = (minutes: number) =>
    setEditedCheckIn(
      Math.min(Math.max(minutes, CHECKIN_MIN_MINUTES), CHECKIN_MAX_MINUTES),
    );
  const setCheckOut = (minutes: number) =>
    setEditedCheckOut(
      Math.min(Math.max(minutes, CHECKOUT_MIN_MINUTES), CHECKOUT_MAX_MINUTES),
    );
  const handlePickDate = (nextDate: string | null) => {
    setSelectedDate(nextDate);
    setEditedCheckIn(null);
    setEditedCheckOut(null);
  };
  const isProofRequired = !!selectedDate && !record;
  const blockMsg = !selectedDate
    ? t("kor.blokTgl")
    : checkOutMinutes < checkInMinutes + 60
      ? t("kor.blokJam")
      : reasonText.trim().length < 15
        ? t("kor.blokPenjelasan")
        : isProofRequired && files.length === 0
          ? t("kor.blokBukti")
          : "";
  const canSubmit = !blockMsg && !isSending;
  const footer = selectedDate
    ? [
        {
          label: t("kor.tanggal"),
          value: `${getWeekdayName(selectedDate)}, ${formatShortDate(selectedDate)}`,
        },
        {
          label: t("kor.logTercatat"),
          value: record
            ? ATTENDANCE_STATUS_LABEL[record.status]
            : t("kor.tidakAda"),
          accent: !record,
        },
      ]
    : [
        { label: t("kor.tanggal"), value: t("kor.belumDipilih") },
        { label: t("kor.logTercatat"), value: "—" },
      ];
  const buildDoneRows = () => {
    if (!selectedDate) return [];
    return [
      {
        k: t("kor.tanggal"),
        v: `${getWeekdayName(selectedDate)}, ${formatShortDate(selectedDate)}`,
      },
      {
        k: t("kor.jamDiajukan"),
        v: `${formatHoursMinutes(checkInMinutes)} – ${formatHoursMinutes(checkOutMinutes)}`,
      },
      { k: t("kor.jenis"), v: getCorrectionKindName(kind) },
      { k: t("kor.bukti"), v: t("kor.nFile", { n: files.length }) },
    ];
  };
  const approvalSteps: ApprovalStep[] = approver
    ? [
        {
          stepLabel: approver.initials,
          name: approver.fullName,
          role: t("lr.atasan"),
        },
      ]
    : [];
  const addProof = async () => {
    const r = await pickProof();
    if (!r) return;
    if ("tooLargeSizeLabel" in r) {
      setErrorMessage(t("up.besarPesan", { ukuran: r.tooLargeSizeLabel }));
      return;
    }
    setErrorMessage(null);
    setFiles((prev) => [...prev, r.file]);
  };
  const handleSubmit = async () => {
    if (!employee || !selectedDate || !canSubmit) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      const res = await hrisApi.submitAttendanceCorrection({
        employeeId: employee.id,
        date: selectedDate,
        requestedCheckIn: formatHoursMinutes(checkInMinutes),
        requestedCheckOut: formatHoursMinutes(checkOutMinutes),
        reason: joinReason(kind, reasonText),
        attachments: files.flatMap((f) =>
          f.uri
            ? [{ uri: f.uri, name: f.name, mimeType: f.mimeType ?? "" }]
            : [],
        ),
      });
      setDone(res.id);
      if (res.failedProofCount) {
        void confirm({
          title: t("lr.buktiGagalJudul"),
          message: t("lr.buktiGagalPesan", { n: res.failedProofCount }),
          tone: "warn",
          confirmText: t("umum.mengerti"),
          cancelText: null,
        });
      }
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  return {
    approver,
    selectedDate,
    kind,
    setKind,
    reasonText,
    setReasonText,
    files,
    setFiles,
    isSending,
    done,
    errorMessage,
    record,
    checkIn: checkInMinutes,
    checkOut: checkOutMinutes,
    setCheckIn,
    setCheckOut,
    handlePickDate,
    isProofRequired,
    blockMsg,
    canSubmit,
    footer,
    buildDoneRows,
    approvalSteps,
    addProof,
    handleSubmit,
  };
}
