import { useMemo } from "react";
import { type ScreenProps } from "@/navigation/types";
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Palette,
  secondaryButtonStyle,
  primaryButtonStyle,
} from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import { ChangeSummary } from "./ChangeSummary";
import { goBackAnimated } from "@/navigation/navigationBack";
import { useProfileChangeReviewDetail } from "@/hooks/useProfileChangeReviewDetail";

// HR: perbandingan data sekarang dengan usulan karyawan, lalu menyetujui
// (usulan diterapkan ke data karyawan) atau menolak dengan catatan.
export function ProfileChangeReviewDetailScreen({
  navigation,
  route,
}: ScreenProps) {
  const {
    p,
    triggerRef,
    isRejecting,
    setIsRejecting,
    note,
    setNote,
    isSending,
    errorMessage,
    setErrorMessage,
    isPending,
    decide,
  } = useProfileChangeReviewDetail({ navigation, route });
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Dialog konfirmasi tumbuh dari tombol ini, seperti dialog Keluar.
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackAnimated(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {p.employeeName}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {[p.designation, p.department].filter(Boolean).join(" · ") ||
              t("pcr.judul")}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.label}>{t("pcr.alasanKaryawan")}</Text>
            <ChangeSummary p={p} hasNoStatus={isPending} />
          </View>
        </ScrollView>

        {isPending ? (
          <View
            style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}
          >
            {isRejecting ? (
              <TextInput
                style={styles.textarea}
                value={note}
                onChangeText={setNote}
                placeholder={t("pcr.alasanTolak")}
                placeholderTextColor={c.mutedLabel}
                multiline
                autoFocus
              />
            ) : null}
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
            <View style={styles.btnRow}>
              {isRejecting ? (
                <>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => {
                      setIsRejecting(false);
                      setErrorMessage(null);
                    }}
                  >
                    <Text style={styles.secondaryText}>{t("umum.batal")}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.rejectBtn, { flex: 2 }]}
                    disabled={isSending}
                    onPress={() => decide("reject")}
                  >
                    <Text style={styles.rejectText}>
                      {isSending ? t("umum.memproses") : t("pcr.kirimTolak")}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={styles.rejectBtn}
                    onPress={() => setIsRejecting(true)}
                  >
                    <Text style={styles.rejectText}>{t("pcr.tolak")}</Text>
                  </Pressable>
                  <Pressable
                    ref={triggerRef}
                    style={{ flex: 2 }}
                    disabled={isSending}
                    onPress={() => decide("approve")}
                  >
                    <LinearGradient
                      colors={[c.accent, c.accent2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.approveBtn}
                    >
                      <Text style={styles.approveText}>
                        {isSending ? t("umum.memproses") : t("pcr.setujui")}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
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
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },
    content: { paddingHorizontal: 18, paddingBottom: 40 },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      gap: 10,
    },
    label: { fontSize: 11, fontWeight: "700", color: c.mutedLabel },
    actionBar: {
      paddingHorizontal: 18,
      paddingTop: 12,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    textarea: {
      marginBottom: 10,
      minHeight: 80,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      padding: 12,
      fontSize: 13,
      color: c.ink,
      textAlignVertical: "top",
    },
    errorText: {
      marginBottom: 10,
      fontSize: 12,
      fontWeight: "600",
      color: c.bad.ink,
      textAlign: "center",
    },
    btnRow: { flexDirection: "row", gap: 9 },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      ...secondaryButtonStyle(c),
      alignItems: "center",
    },
    secondaryText: { fontSize: 13, fontWeight: "700", color: c.btnSoftInk },
    rejectBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.bad.bg,
      alignItems: "center",
    },
    rejectText: { fontSize: 13, fontWeight: "700", color: c.bad.ink },
    approveBtn: {
      ...primaryButtonStyle(c),
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    approveText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
