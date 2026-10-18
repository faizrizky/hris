import { useMemo } from "react";
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
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { DatePickerCard } from "@/components/DatePickerCard";
import { ApprovalFlowCard, FormDoneView } from "@/screens/leave/FormFlowCards";
import {
  CorrectionReasonCard,
  CorrectionProofCard,
  RequestedTimeCard,
  RecordedCard,
} from "./CorrectionCards";
import { formatHourDuration } from "@/utils/date";
import { useT } from "@/i18n";
import { goBackAnimated, goHome } from "@/navigation/navigationBack";
import { useAttendanceCorrection } from "@/hooks/useAttendanceCorrection";

export function AttendanceCorrectionScreen({ navigation }: ScreenProps) {
  const {
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
    masuk,
    keluar,
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
  } = useAttendanceCorrection();
  const t = useT();
  const insets = useSafeAreaInsets();
  // Jam yang diubah pengguna; null = pakai jam tercatat tanggal itu (atau bawaan).
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Clamp di setter: dua nilai ini independen, hubungannya diurus validasi.
  // Ganti tanggal membuang jam yang diubah, supaya jam tercatat tanggal baru yang tampil.
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
