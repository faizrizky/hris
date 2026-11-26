import { useEffect, useState } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { Animated, Easing } from "react-native";
import {
  LeaveKind,
  leaveName,
  SERVER_KINDS,
} from "@/screens/leave/LeaveFormCards";
import { ApprovalStep } from "@/screens/leave/FormFlowCards";
import { ProofAttachment } from "@/screens/leave/OvertimeFormCards";
import { TransportMode } from "@/screens/leave/TripFormCards";
import { Expense, totalExpense } from "@/screens/leave/TripExpenseCard";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { useTenant, type Fitur } from "@/services/tenant";
import { LeaveBalance, Colleague, LeaveApprover } from "@/services/types";
import { FooterItem } from "@/components/DatePickerCard";
import {
  formatShortDate,
  countDays,
  countWorkdays,
  fromISODate,
  formatHoursMinutes,
  formatHourDuration,
} from "@/utils/date";
import { rupiah } from "@/utils/currency";
import { describeError } from "@/services/api/http";
import { useT, translate } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { pickProof } from "@/utils/pickProof";
import { WFH_DAYS } from "@/screens/leave/WfhFormCards";

export const FORM_SEGMENTS = [
  { key: "cuti", label: "lr.cuti" },
  { key: "lembur", label: "lr.lembur" },
  { key: "wfh", label: "lr.wfh" },
] as const;

// Travel Request is locked in the web (Expenses module), so it is not offered as a segment; the kind stays for old code paths.
export type FormKind = (typeof FORM_SEGMENTS)[number]["key"] | "dinas";

// Pengajuan di luar paket langganan company tidak ditawarkan.
const SEGMENT_FITUR: Partial<Record<FormKind, Fitur>> = {
  lembur: "lembur",
  dinas: "dinas_wfh",
  wfh: "dinas_wfh",
};

export const FORM_META = {
  cuti: { title: "lr.judulCuti", subtitle: "Leave Application" },
  lembur: { title: "lr.judulLembur", subtitle: "Overtime Request" },
  dinas: { title: "lr.judulDinas", subtitle: "Travel Request" },
  wfh: { title: "lr.judulWfh", subtitle: "WFH Schedule" },
} as const;

export interface LeaveRequestParams {
  kind?: FormKind;
  n?: number;
}

export function useLeaveRequestForm({ route }: Pick<ScreenProps, "route">) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const { punyaFitur } = useTenant();
  const segments = FORM_SEGMENTS.filter((s) => {
    const f = SEGMENT_FITUR[s.key];
    return !f || punyaFitur(f);
  });
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveKind, setLeaveKind] = useState<LeaveKind>("Tahunan");
  const [gender, setGender] = useState<"F" | "M" | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [colleagueList, setColleagueList] = useState<Colleague[]>([]);
  const [delegatePerson, setDelegatePerson] = useState<Colleague | null>(null);
  const [kind, setKind] = useState<FormKind>(
    getRouteParams<LeaveRequestParams>(route).kind ?? "cuti",
  );
  const [segW, setSegW] = useState(0);
  const [slide] = useState(
    () => new Animated.Value(segments.findIndex((x) => x.key === kind)),
  );
  const [appear] = useState(() => new Animated.Value(1));
  const [otEndRaw, setOtEndRaw] = useState(0);
  const [taskDescription, setTaskDescription] = useState("");
  const [otFiles, setOtFiles] = useState<ProofAttachment[]>([]);
  const [wfhWeekdays, setWfhWeekdays] = useState<string[]>([]);
  const [wfhReason, setWfhReason] = useState("");
  const [cutiFiles, setCutiFiles] = useState<ProofAttachment[]>([]);
  const [destinationText, setDestinationText] = useState("");
  const [transport, setTransport] = useState<TransportMode | null>(null);
  const [purposeText, setPurposeText] = useState("");
  const [expensesState, setExpensesState] = useState<Expense[]>([]);
  const [approver, setApprover] = useState<LeaveApprover | null | undefined>(
    undefined,
  );
  const meta = FORM_META[kind];
  const isSingle = kind === "lembur";
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [otDate, setOtDate] = useState<string | null>(null);
  const start = isSingle ? otDate : rangeStart;
  const end = isSingle ? otDate : rangeEnd;
  const range = start && end;
  const isOtHoliday = !!otDate && [0, 6].includes(fromISODate(otDate).getDay());
  const otStart = isOtHoliday ? 8 * 60 : 17 * 60;
  const otMax = isOtHoliday ? 8 * 60 : 4 * 60;
  const otEnd = Math.min(Math.max(otEndRaw, otStart + 60), otStart + otMax);
  const otJam = (otEnd - otStart) / 60;
  const tripDays = start && end ? countDays(start, end) : 0;
  const totalTrip = totalExpense(expensesState, tripDays);
  const [done, setDone] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const switchKind = (k: FormKind) => {
    if (k === kind) return;
    setKind(k);
    setDone(null);
    setErrorMessage(null);
    Animated.timing(slide, {
      toValue: segments.findIndex((x) => x.key === k),
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  useEffect(() => {
    if (!employee) return;
    // Kegagalan memuat ditampilkan di ringkasan bawah (galat), bukan dibiarkan
    // sebagai penolakan promise yang tak tertangkap.
    const capture = (e: unknown) => setErrorMessage(describeError(e));
    hrisApi.getLeaveBalances(employee.id).then(setBalances).catch(capture);
    hrisApi.getColleagues(employee.id).then(setColleagueList).catch(capture);
    hrisApi.getLeaveApprover(employee.id).then(setApprover).catch(capture);
    // Jenis cuti tertentu hanya untuk satu jenis kelamin.
    hrisApi
      .getPersonalProfile(employee.id)
      .then((p) =>
        setGender(
          p.gender === translate("api.perempuan")
            ? "F"
            : p.gender === translate("api.lakiLaki")
              ? "M"
              : null,
        ),
      )
      .catch(() => {});
  }, [employee]);
  const leaveBalanceList =
    balances.find((b) => b.type === "cuti")?.remaining ?? 0;
  const workdayCount =
    start && end
      ? leaveKind === "Melahirkan"
        ? countDays(start, end)
        : countWorkdays(start, end)
      : 0;
  const missingExpenseProofCount = expensesState.filter(
    (x) => Number(x.nominal) > 0 && !x.proof,
  ).length;
  const blockMsg = !start
    ? t("lr.blokTgl")
    : !end
      ? t("lr.blokTglSelesai")
      : kind === "cuti" &&
          leaveKind === "Sakit" &&
          workdayCount > 1 &&
          cutiFiles.length === 0
        ? t("lr.blokSurat")
        : kind === "cuti" && !reasonText.trim()
          ? t("lr.blokAlasan")
          : kind === "cuti" && approver === null
            ? t("lr.blokApprover")
            : kind === "lembur" && !taskDescription.trim()
              ? t("lr.blokUraian")
              : kind === "lembur" && otFiles.length === 0
                ? t("lr.blokBukti")
                : kind === "dinas" && !destinationText.trim()
                  ? t("lr.blokKota")
                  : kind === "dinas" && !transport
                    ? t("lr.blokTransport")
                    : kind === "dinas" && missingExpenseProofCount
                      ? t("lr.blokBiaya", { n: missingExpenseProofCount })
                      : kind === "wfh" && !wfhReason.trim()
                        ? t("lr.blokAlasanWfh")
                        : kind === "wfh" && approver === null
                          ? t("lr.blokApprover")
                          : "";
  const canSubmit = !blockMsg && !isSending;
  const addProof = async () => {
    const r = await pickProof();
    if (!r) return;
    if ("tooLargeSizeLabel" in r) {
      setErrorMessage(t("up.besarPesan", { ukuran: r.tooLargeSizeLabel }));
      return;
    }
    setErrorMessage(null);
    setOtFiles((prev) => [...prev, r.file]);
  };
  const addLeaveProof = async () => {
    const r = await pickProof();
    if (!r) return;
    if ("tooLargeSizeLabel" in r) {
      setErrorMessage(t("up.besarPesan", { ukuran: r.tooLargeSizeLabel }));
      return;
    }
    setErrorMessage(null);
    setCutiFiles((prev) => [...prev, r.file]);
  };
  const handleSubmit = async () => {
    if (!canSubmit || !employee) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      const created = await hrisApi.submitLeaveRequest({
        fromDate: start!,
        toDate: end!,
        employeeId: employee.id,
        type:
          kind === "lembur"
            ? "lembur"
            : kind === "dinas"
              ? "dinas_luar"
              : kind === "wfh"
                ? "wfh"
                : leaveKind === "Sakit"
                  ? "sakit"
                  : "cuti",
        label:
          kind === "cuti"
            ? t("lr.labelCuti", {
                jenis: leaveName(leaveKind),
                n: workdayCount,
              })
            : kind === "lembur"
              ? t("lr.labelLembur", {
                  durasi: formatHourDuration(otJam),
                  tgl: formatShortDate(start!),
                })
              : kind === "wfh"
                ? wfhWeekdays.length === 0
                  ? t("lr.labelWfhSemua")
                  : t("lr.labelWfh", { n: wfhWeekdays.length })
                : t("lr.labelDinas", { n: tripDays }),
        reason:
          kind === "cuti"
            ? reasonText.trim()
            : kind === "lembur"
              ? taskDescription.trim()
              : kind === "wfh"
                ? wfhReason.trim()
                : `${destinationText.trim()} · ${purposeText.trim()}`,
        delegateName:
          kind === "cuti" && delegatePerson
            ? delegatePerson.fullName
            : undefined,
        delegateId:
          kind === "cuti" && delegatePerson ? delegatePerson.id : undefined,
        leaveType: kind === "cuti" ? SERVER_KINDS[leaveKind] : undefined,
        wfhDays: kind === "wfh" ? wfhWeekdays : undefined,
        overtimeEnd: kind === "lembur" ? formatHoursMinutes(otEnd) : undefined,
        attachments: (kind === "lembur"
          ? otFiles
          : kind === "cuti"
            ? cutiFiles
            : []
        ).flatMap((f) =>
          f.uri
            ? [{ uri: f.uri, name: f.name, mimeType: f.mimeType ?? "" }]
            : [],
        ),
        travel:
          kind === "dinas" && transport
            ? {
                destination: destinationText.trim(),
                transport,
                purpose: purposeText.trim() || destinationText.trim(),
                costs: expensesState.map((x) => ({
                  category: x.category,
                  description: x.description,
                  amount: Number(x.nominal) || 0,
                  proof: x.proof
                    ? {
                        uri: x.proof.uri,
                        name: x.proof.name,
                        mimeType: x.proof.mimeType,
                      }
                    : undefined,
                })),
              }
            : undefined,
      });
      setDone(created.id);
      if (created.failedProofCount) {
        void confirm({
          title: t("lr.buktiGagalJudul"),
          message: t("lr.buktiGagalPesan", { n: created.failedProofCount }),
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
  const buildDoneRows = () => {
    if (!start || !end) return [];

    if (kind === "cuti") {
      return [
        { k: t("lr.rowJenis"), v: leaveName(leaveKind) },
        {
          k: t("lr.rowTanggal"),
          v: `${formatShortDate(start)} – ${formatShortDate(end)}`,
        },
        {
          k: t("lr.rowDurasi"),
          v: t(
            leaveKind === "Melahirkan" ? "lr.nHariKalender" : "lr.nHariKerja",
            {
              n: workdayCount,
            },
          ),
        },
        { k: t("lr.rowDelegasi"), v: delegatePerson?.fullName ?? "—" },
      ];
    }

    if (kind === "lembur") {
      return [
        { k: t("lr.rowTanggal"), v: formatShortDate(start) },
        {
          k: t("lr.rowJam"),
          v: `${formatHoursMinutes(otStart)} – ${formatHoursMinutes(otEnd)}`,
        },
        { k: t("lr.rowBukti"), v: t("lr.nFile", { n: otFiles.length }) },
      ];
    }

    if (kind === "wfh") {
      return [
        {
          k: t("lr.rowTanggal"),
          v: `${formatShortDate(start)} – ${formatShortDate(end)}`,
        },
        {
          k: t("lr.rowHariWfh"),
          v:
            wfhWeekdays.length === 0
              ? t("lr.semuaHariWfh")
              : WFH_DAYS.filter((d) => wfhWeekdays.includes(d))
                  .map((d) => t(`hari.${d}` as never))
                  .join(", "),
        },
      ];
    }

    return [
      { k: t("lr.rowTujuan"), v: destinationText },
      {
        k: t("lr.rowTanggal"),
        v: `${formatShortDate(start)} – ${formatShortDate(end)}`,
      },
      { k: t("lr.rowTotalBiaya"), v: rupiah(totalTrip.total) },
      {
        k: t("lr.rowBukti"),
        v: t("lr.nFile", { n: expensesState.filter((x) => x.proof).length }),
      },
    ];
  };
  const handleDateChange = (s: string | null, e: string | null) => {
    if (isSingle) {
      setOtDate(s);
    } else {
      setRangeStart(s);
      setRangeEnd(e);
    }
  };
  const calTitle =
    kind === "dinas"
      ? t("lr.tglPerjalanan")
      : kind === "wfh"
        ? t("lr.tglWfh")
        : kind === "lembur"
          ? t("lr.tglLembur")
          : t("lr.tglCuti");
  const calHint = isSingle ? t("lr.hintSatu") : t("lr.hintRentang");
  const footer: FooterItem[] = isSingle
    ? [
        {
          label: t("lr.tanggal"),
          value: start ? formatShortDate(start) : t("lr.pilih"),
        },
        {
          label: t("lr.jenisHari"),
          value: start
            ? [0, 6].includes(fromISODate(start).getDay())
              ? t("lr.hariLibur")
              : t("lr.hariKerja")
            : "—",
        },
        {
          label: t("lr.durasi"),
          value: otDate ? formatHourDuration(otJam) : "—",
          accent: true,
        },
      ]
    : [
        {
          label: t("lr.mulai"),
          value: start ? formatShortDate(start) : t("lr.pilih"),
        },
        {
          label: t("lr.selesai"),
          value: end ? formatShortDate(end) : t("lr.pilih"),
        },
        {
          label: t("lr.durasi"),
          value: range
            ? kind === "dinas" || kind === "wfh"
              ? t("lr.nHari", { n: countDays(start!, end!) })
              : leaveKind === "Melahirkan" && kind === "cuti"
                ? t("lr.nHariKalender", { n: workdayCount })
                : t("lr.nHariKerja", { n: countWorkdays(start!, end!) })
            : "—",
          accent: true,
        },
      ];
  const approvalSteps: ApprovalStep[] = approver
    ? [
        {
          stepLabel: approver.initials,
          name: approver.fullName,
          role: t("lr.atasan"),
        },
      ]
    : [];
  return {
    segments,
    leaveKind,
    setLeaveKind,
    gender,
    reasonText,
    setReasonText,
    colleagueList,
    delegatePerson,
    setDelegatePerson,
    kind,
    segW,
    setSegW,
    slide,
    appear,
    setOtEndRaw,
    taskDescription,
    setTaskDescription,
    otFiles,
    setOtFiles,
    wfhWeekdays,
    setWfhWeekdays,
    wfhReason,
    setWfhReason,
    cutiFiles,
    setCutiFiles,
    destinationText,
    setDestinationText,
    transport,
    setTransport,
    purposeText,
    setPurposeText,
    expensesState,
    setExpensesState,
    meta,
    isSingle,
    otDate,
    start,
    end,
    isOtHoliday,
    otStart,
    otEnd,
    otJam,
    tripDays,
    totalTrip,
    done,
    isSending,
    errorMessage,
    switchKind,
    leaveBalanceList,
    workdayCount,
    blockMsg,
    canSubmit,
    addProof,
    addLeaveProof,
    handleSubmit,
    buildDoneRows,
    handleDateChange,
    calTitle,
    calHint,
    footer,
    approvalSteps,
  };
}
