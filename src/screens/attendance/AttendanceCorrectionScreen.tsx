import { useEffect, useState, useMemo } from "react";
import type { ScreenProps } from "@/navigation/types";
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { joinReason } from "@/utils/Correction";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { AttendanceRecord, LeaveApprover } from "@/services/types";
import { ATTENDANCE_STATUS_LABEL } from "@/constants/statusLabels";
import { DatePickerCard } from "@/components/DatePickerCard";
import {
  ApprovalFlowCard,
  ApprovalStep,
  FormDoneView,
} from "@/screens/leave/FormFlowCards";
import { ProofAttachment } from "@/screens/leave/LemburFormCards";
import {
  CorrectionReasonCard,
  CorrectionProofCard,
  RequestedTimeCard,
  CorrectionKind,
  RecordedCard,
  getCorrectionKindName,
} from "./KoreksiCards";
import {
  formatHourDuration,
  formatHoursMinutes,
  minutesOf,
  getWeekdayName,
  formatShortDate,
} from "@/utils/date";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { pickProof } from "@/utils/pilihBukti";
import { goBackAnimated, goHome } from "@/navigation/kembali";

const DEFAULT_CHECKIN_MINUTES = 8 * 60; // menit sejak 00:00
const DEFAULT_CHECKOUT_MINUTES = 17 * 60;
const CHECKIN_MIN_MINUTES = 5 * 60;
const CHECKIN_MAX_MINUTES = 12 * 60;
const CHECKOUT_MIN_MINUTES = 6 * 60;
const CHECKOUT_MAX_MINUTES = 23 * 60 + 45;

export function AttendanceCorrectionScreen({ navigation }: ScreenProps) {
  const t = useT();
  const confirm = useConfirm();
  const [approver, setApprover] = useState<LeaveApprover | null>(null);
  const { employee } = useSession();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Jam yang diubah pengguna; null = pakai jam tercatat tanggal itu (atau bawaan).
  const [editedCheckIn, setEditedCheckIn] = useState<number | null>(null);
  const [editedCheckOut, setEditedCheckOut] = useState<number | null>(null);
  const [kind, setKind] = useState<CorrectionKind>("Forgot check-in");
  const [reasonText, setReasonText] = useState("");
  const [files, setFiles] = useState<ProofAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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

  const masuk =
    editedCheckIn ??
    (record?.checkIn ? minutesOf(record.checkIn) : DEFAULT_CHECKIN_MINUTES);
  const keluar =
    editedCheckOut ??
    (record?.checkOut ? minutesOf(record.checkOut) : DEFAULT_CHECKOUT_MINUTES);

  // Clamp di setter: dua nilai ini independen, hubungannya diurus validasi.
  const setCheckIn = (minutes: number) =>
    setEditedCheckIn(
      Math.min(Math.max(minutes, CHECKIN_MIN_MINUTES), CHECKIN_MAX_MINUTES),
    );
  const setCheckOut = (minutes: number) =>
    setEditedCheckOut(
      Math.min(Math.max(minutes, CHECKOUT_MIN_MINUTES), CHECKOUT_MAX_MINUTES),
    );

  // Ganti tanggal membuang jam yang diubah, supaya jam tercatat tanggal baru yang tampil.
  const handlePickDate = (nextDate: string | null) => {
    setSelectedDate(nextDate);
    setEditedCheckIn(null);
    setEditedCheckOut(null);
  };

  const isProofRequired = !!selectedDate && !record;

  const blockMsg = !selectedDate
    ? t("kor.blokTgl")
    : keluar < masuk + 60
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
        v: `${formatHoursMinutes(masuk)} – ${formatHoursMinutes(keluar)}`,
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
        requestedCheckIn: formatHoursMinutes(masuk),
        requestedCheckOut: formatHoursMinutes(keluar),
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
            <Text style={styles.headerTitle}>{t("kor.judul")}</Text>
            <Text style={styles.headerSub}>Attendance Request</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {done ? (
            <FormDoneView
              title={t("kor.terkirim")}
              waitingOn={approver?.fullName ?? t("lr.approver")}
              rows={buildDoneRows()}
              doc={`Attendance Request · HR-ATR-${done}`}
              onView={() => navigation.navigate("AttendanceCorrectionHistory")}
              onHome={() => goHome(navigation)}
            />
          ) : (
            <>
              <DatePickerCard
                mode="single"
                allow="past"
                title={t("kor.tglKoreksi")}
                hint={t("kor.hintTgl")}
                start={selectedDate}
                end={selectedDate}
                onChange={handlePickDate}
                footer={footer}
              />

              {selectedDate && <RecordedCard record={record} />}

              <RequestedTimeCard
                masuk={masuk}
                keluar={keluar}
                onChangeCheckIn={setCheckIn}
                onChangeCheckOut={setCheckOut}
              />

              <CorrectionReasonCard
                kind={kind}
                onPickKind={setKind}
                reason={reasonText}
                onChangeReason={setReasonText}
              />

              <CorrectionProofCard
                files={files}
                isRequired={isProofRequired}
                onAdd={addProof}
                onRemove={(i) =>
                  setFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
              />

              <ApprovalFlowCard steps={approvalSteps} />
            </>
          )}
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
              {blockMsg || errorMessage || t("kor.siap")}
            </Text>
            <Text style={styles.sumTop}>
              {selectedDate && keluar > masuk
                ? formatHourDuration((keluar - masuk) / 60)
                : "—"}
            </Text>
          </View>
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
                {isSending ? t("kor.mengirim") : t("kor.kirim")}
              </Text>
            </LinearGradient>
          </Pressable>
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

    content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24 },

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
    sumTop: {
      fontSize: 16,
      fontWeight: "800",
      color: c.ink,
      marginTop: 3,
    },
    submitBtn: {
      ...primaryButtonStyle(c),
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 16,
    },
    submitText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
