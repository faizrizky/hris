import { useMemo } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import {
  Animated,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { LeaveTypeCard, LeaveDetailCard } from "./LeaveFormCards";
import { ApprovalFlowCard, FormDoneView } from "./FormFlowCards";
import {
  OvertimeHoursCard,
  OvertimeDescriptionCard,
  OvertimeProofCard,
} from "./OvertimeFormCards";
import { DinasTujuanCard, DinasDetailCard } from "./TripFormCards";

import { DinasBiayaCard } from "./TripExpenseCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { DatePickerCard } from "@/components/DatePickerCard";
import { formatHoursMinutes, formatHourDuration } from "@/utils/date";
import { rupiah } from "@/utils/currency";
import { LinearGradient } from "expo-linear-gradient";
import { useT } from "@/i18n";
import { WfhDetailCard } from "./WfhFormCards";
import { goBackAnimated, goHome } from "@/navigation/navigationBack";
import {
  useLeaveRequestForm,
  FORM_SEGMENTS,
  FormKind,
  LeaveRequestParams,
} from "@/hooks/useLeaveRequestForm";

// Nama dokumen ERPNext tempat pengajuan tersimpan.
const DOC_NAMA: Record<FormKind, string> = {
  cuti: "Leave Application",
  lembur: "Overtime Request",
  dinas: "Travel Request",
  wfh: "WFH Schedule",
};

// Setiap kali dibuka dari menu (+), daftar cuti, atau layar lembur, form dimulai
// bersih: `n` di params berbeda tiap navigasi, jadi state lama tidak terbawa.

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
  const {
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
    balances2,
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
  } = useLeaveRequestForm({ route });
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Ganti jenis pengajuan: indikator bergeser, isi form memudar masuk, dan
  // hasil kiriman sebelumnya tidak ikut ke jenis lain.
  // Cuti melahirkan dihitung hari kalender; yang lain hari kerja.
  // Rentang (cuti, dinas) baru lengkap setelah tanggal selesai dipilih; tanpa itu
  // toDate terkirim null dan server menolaknya.
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
