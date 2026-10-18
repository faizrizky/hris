import React, { useEffect, useState, useMemo } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import {
  LeaveTypeCard,
  LeaveDetailCard,
  LeaveKind,
  leaveName,
  SERVER_KINDS,
} from "./LeaveFormCards";
import { ApprovalFlowCard, FormDoneView, ApprovalStep } from "./FormFlowCards";
import {
  OvertimeHoursCard,
  OvertimeDescriptionCard,
  OvertimeProofCard,
  ProofAttachment,
} from "./OvertimeFormCards";
import {
  DinasTujuanCard,
  DinasDetailCard,
  TransportMode,
} from "./TripFormCards";

import { DinasBiayaCard, Expense, totalExpense } from "./TripExpenseCard";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveBalance, Colleague, LeaveApprover } from "@/services/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { DatePickerCard, FooterItem } from "@/components/DatePickerCard";
import {
  formatShortDate,
  countDays,
  countWorkdays,
  fromISODate,
  formatHoursMinutes,
  formatHourDuration,
} from "@/utils/date";
import { rupiah } from "@/utils/currency";
import { LinearGradient } from "expo-linear-gradient";
import { describeError } from "@/services/api/http";
import { useT, translate } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { pickProof } from "@/utils/pickProof";
import { WfhDetailCard, WFH_DAYS } from "./WfhFormCards";
import { goBackAnimated, goHome } from "@/navigation/navigationBack";

const FORM_SEGMENTS = [
  { key: "cuti", label: "lr.cuti" },
  { key: "lembur", label: "lr.lembur" },
  { key: "dinas", label: "lr.dinas" },
  { key: "wfh", label: "lr.wfh" },
] as const;

export type FormKind = (typeof FORM_SEGMENTS)[number]["key"];

const FORM_META = {
  cuti: { title: "lr.judulCuti", subtitle: "Leave Application" },
  lembur: { title: "lr.judulLembur", subtitle: "Overtime Request" },
  dinas: { title: "lr.judulDinas", subtitle: "Travel Request" },
  wfh: { title: "lr.judulWfh", subtitle: "WFH Schedule" },
} as const;

// Nama dokumen ERPNext tempat pengajuan tersimpan.
const DOC_NAMA: Record<FormKind, string> = {
  cuti: "Leave Application",
  lembur: "Overtime Request",
  dinas: "Travel Request",
  wfh: "WFH Schedule",
};

// Setiap kali dibuka dari menu (+), daftar cuti, atau layar lembur, form dimulai
// bersih: `n` di params berbeda tiap navigasi, jadi state lama tidak terbawa.
interface LeaveRequestParams {
  kind?: FormKind;
  n?: number;
}

export function LeaveRequestScreen({ navigation, route }: ScreenProps) {
  const { kind, n } = getRouteParams<LeaveRequestParams>(route);
  return (
    <LeaveRequestForm
      key={`${kind ?? "cuti"}-${n ?? 0}`}
      navigation={navigation}
      route={route}
    />
  );
}

function LeaveRequestForm({ navigation, route }: ScreenProps) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveKind, setLeaveKind] = useState<LeaveKind>("Tahunan");
  const [gender, setGender] = useState<"F" | "M" | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [colleagueList, setColleagueList] = useState<Colleague[]>([]);
  const [delegatePerson, setDelegatePerson] = useState<Colleague | null>(null);
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<FormKind>(
    getRouteParams<LeaveRequestParams>(route).kind ?? "cuti",
  );
  const [segW, setSegW] = useState(0);
  const [slide] = useState(
    () => new Animated.Value(FORM_SEGMENTS.findIndex((x) => x.key === kind)),
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
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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

  const [done, setDone] = useState<string | null>(null); // id pengajuan
  const [isSending, setIsSending] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ganti jenis pengajuan: indikator bergeser, isi form memudar masuk, dan
  // hasil kiriman sebelumnya tidak ikut ke jenis lain.
  const switchKind = (k: FormKind) => {
    if (k === kind) return;
    setKind(k);
    setDone(null);
    setErrorMessage(null);
    Animated.timing(slide, {
      toValue: FORM_SEGMENTS.findIndex((x) => x.key === k),
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

  const balances2 = balances.find((b) => b.type === "cuti")?.remaining ?? 0;
  // Cuti melahirkan dihitung hari kalender; yang lain hari kerja.
  const workdayCount =
    start && end
      ? leaveKind === "Melahirkan"
        ? countDays(start, end)
        : countWorkdays(start, end)
      : 0;

  const missingExpenseProofCount = expensesState.filter(
    (x) => Number(x.nominal) > 0 && !x.proof,
  ).length;

  // Rentang (cuti, dinas) baru lengkap setelah tanggal selesai dipilih; tanpa itu
  // toDate terkirim null dan server menolaknya.
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
    : []; // masih memuat, atau tidak ada approver

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backBtn}
            onPress={() => goBackAnimated(navigation)}
          >
            <Ionicons name="chevron-back" size={18} color={c.ink} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle}>{t(meta.title)}</Text>
            <Text style={styles.headerSub}>{meta.subtitle}</Text>
          </View>
        </View>

        <View
          style={styles.segment}
          onLayout={(e) => setSegW(e.nativeEvent.layout.width)}
        >
          {segW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.segIndicator,
                {
                  width:
                    (segW - 8 - 4 * (FORM_SEGMENTS.length - 1)) /
                    FORM_SEGMENTS.length,
                  transform: [
                    {
                      translateX: slide.interpolate({
                        inputRange: FORM_SEGMENTS.map((_, i) => i),
                        outputRange: FORM_SEGMENTS.map(
                          (_, i) =>
                            ((segW - 8 - 4 * (FORM_SEGMENTS.length - 1)) /
                              FORM_SEGMENTS.length +
                              4) *
                            i,
                        ),
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          {FORM_SEGMENTS.map((s) => {
            const isOn = kind === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => switchKind(s.key)}
                style={styles.segBtn}
              >
                <Text
                  style={[styles.segText, isOn && styles.segTextOn]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {t(s.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: appear,
              transform: [
                {
                  translateY: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
          >
            {done ? (
              <FormDoneView
                title={t(
                  kind === "cuti"
                    ? "lr.terkirimCuti"
                    : kind === "lembur"
                      ? "lr.terkirimLembur"
                      : kind === "wfh"
                        ? "lr.terkirimWfh"
                        : "lr.terkirimDinas",
                )}
                waitingOn={approvalSteps[0]?.name ?? t("lr.approver")}
                rows={buildDoneRows()}
                doc={`${DOC_NAMA[kind]} · ${done}`}
                onView={() => goBackAnimated(navigation)}
                onHome={() => goHome(navigation)}
              />
            ) : (
              <>
                {kind === "cuti" && (
                  <LeaveTypeCard
                    kind={leaveKind}
                    onPick={setLeaveKind}
                    balanceList={balances2}
                    workdays={workdayCount}
                    gender={gender}
                  />
                )}
                {kind === "dinas" && (
                  <DinasTujuanCard
                    destination={destinationText}
                    onChange={setDestinationText}
                  />
                )}

                <DatePickerCard
                  key={kind}
                  // Lembur diajukan setelah dikerjakan: hanya hari ini dan sebelumnya.
                  allow={kind === "lembur" ? "past" : "future"}
                  mode={isSingle ? "single" : "range"}
                  title={calTitle}
                  hint={calHint}
                  start={start}
                  end={end}
                  onChange={handleDateChange}
                  footer={footer}
                />

                {kind === "cuti" && (
                  <LeaveDetailCard
                    kind={leaveKind}
                    reason={reasonText}
                    onChangeReason={setReasonText}
                    colleagues={colleagueList}
                    delegate={delegatePerson}
                    onPickDelegate={setDelegatePerson}
                    files={cutiFiles}
                    onAdd={addLeaveProof}
                    onRemove={(i) =>
                      setCutiFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  />
                )}

                {kind === "lembur" && (
                  <>
                    <OvertimeHoursCard
                      isHoliday={isOtHoliday}
                      startLabel={formatHoursMinutes(otStart)}
                      endLabel={formatHoursMinutes(otEnd)}
                      rule={
                        isOtHoliday ? t("lr.aturanLibur") : t("lr.aturanKerja")
                      }
                      onMinus={() => setOtEndRaw(otEnd - 30)}
                      onPlus={() => setOtEndRaw(otEnd + 30)}
                    />
                    <OvertimeDescriptionCard
                      description={taskDescription}
                      onChange={setTaskDescription}
                    />
                    <OvertimeProofCard
                      files={otFiles}
                      onAdd={addProof}
                      onRemove={(i) =>
                        setOtFiles((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    />
                  </>
                )}

                {kind === "wfh" && (
                  <WfhDetailCard
                    days={wfhWeekdays}
                    onToggle={(d) =>
                      setWfhWeekdays((prev) =>
                        prev.includes(d)
                          ? prev.filter((x) => x !== d)
                          : [...prev, d],
                      )
                    }
                    reason={wfhReason}
                    onChangeReason={setWfhReason}
                  />
                )}

                {kind === "dinas" && (
                  <DinasDetailCard
                    transport={transport}
                    onPickTransport={setTransport}
                    purpose={purposeText}
                    onChangePurpose={setPurposeText}
                  />
                )}

                {kind === "dinas" && (
                  <DinasBiayaCard
                    items={expensesState}
                    days={tripDays}
                    onAdd={() =>
                      setExpensesState((prev) => [
                        ...prev,
                        {
                          id: `b${Date.now()}`,
                          category: "Transportasi",
                          description: "",
                          nominal: "",
                          proof: null,
                        },
                      ])
                    }
                    onRemove={(id) =>
                      setExpensesState((prev) =>
                        prev.filter((x) => x.id !== id),
                      )
                    }
                    onChange={(id, patch) =>
                      setExpensesState((prev) =>
                        prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
                      )
                    }
                  />
                )}
                <ApprovalFlowCard steps={approvalSteps} />
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {!done && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[
                styles.sumSub,
                blockMsg || errorMessage ? { color: c.bad.ink } : null,
              ]}
            >
              {blockMsg || errorMessage || t("lr.siap")}
            </Text>
            <Text style={styles.sumTop}>
              {kind === "cuti" && workdayCount > 0
                ? t(
                    leaveKind === "Melahirkan"
                      ? "lr.nHariKalender"
                      : "lr.nHariKerja",
                    { n: workdayCount },
                  )
                : kind === "lembur" && otDate
                  ? formatHourDuration(otJam)
                  : kind === "dinas" && start && end
                    ? rupiah(totalTrip.total)
                    : "—"}
            </Text>
          </View>
          {/* Tombol kirim baru muncul setelah form lengkap. */}
          {canSubmit || isSending ? (
            <Pressable onPress={handleSubmit} disabled={!canSubmit}>
              <LinearGradient
                colors={canSubmit ? [c.accent, c.accent2] : [c.track, c.track]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitBtn}
              >
                <Text
                  style={[
                    styles.submitText,
                    canSubmit ? { color: "#fff" } : null,
                  ]}
                >
                  {isSending ? t("lr.mengirim") : t("lr.kirim")}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}
const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.ink },
    headerSub: {
      fontSize: 10.5,
      fontWeight: "600",
      color: c.muted,
      marginTop: 3,
    },

    segment: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: 14,
      backgroundColor: c.chip,
      marginTop: 14,
    },
    segBtn: {
      flex: 1,
      height: 40,
      paddingHorizontal: 4,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    segIndicator: {
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 11,
      backgroundColor: c.card,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.14,
      shadowRadius: 4,
      elevation: 2,
    },
    segText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: c.muted,
      textAlign: "center",
    },
    segTextOn: { color: c.accent },

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
    placeholder: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
    },
    placeholderText: { fontSize: 12.5, color: c.muted },

    actionBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.hair,
      paddingHorizontal: 18,
      paddingTop: 12,
    },
    sumSub: { fontSize: 10.5, fontWeight: "600", color: c.muted },
    sumTop: { fontSize: 16, fontWeight: "800", color: c.ink, marginTop: 3 },
    submitBtn: {
      ...primaryButtonStyle(c),
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 16,
    },
    submitText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
