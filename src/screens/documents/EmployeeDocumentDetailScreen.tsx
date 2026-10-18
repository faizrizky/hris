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
import { DOC_STATUS_LABEL } from "@/constants/statusLabels";
import { useT } from "@/i18n";
import { DocPreview } from "./DocPreview";
import { goBackAnimated } from "@/navigation/navigationBack";
import { useEmployeeDocumentDetail } from "@/hooks/useEmployeeDocumentDetail";

// Karyawan: pratinjau dokumennya sendiri. Dokumen terverifikasi tidak bisa
// diubah langsung; yang bisa dilakukan adalah mengajukan perubahan dengan alasan.
// Dokumen yang menunggu atau ditolak boleh langsung diganti berkasnya.
export function EmployeeDocumentDetailScreen({
  navigation,
  route,
}: ScreenProps) {
  const {
    doc,
    isRequesting,
    setIsRequesting,
    reason,
    setReason,
    isSending,
    errorMessage,
    setErrorMessage,
    isVerified,
    canChange,
    tone,
    submitChange,
    swap,
    info,
    baris,
  } = useEmployeeDocumentDetail({ navigation, route });
  // Salinan dari layar sebelumnya; diperbarui berkala supaya status yang diubah HR langsung tampil.
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Polling hanya selagi status belum final (menunggu / diminta ubah) dan layar aktif di depan.
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
            {doc.name}
          </Text>
          <Text style={styles.headerSub}>{t("dk.judul")}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.badgeText, { color: tone.ink }]}>
            {DOC_STATUS_LABEL[doc.status]}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <DocPreview
            fileUrl={doc.fileUrl}
            fileName={doc.fileName}
            name={doc.name}
            ext={doc.ext}
          />

          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={{ gap: 11 }}>
              {baris.map((r) => (
                <View key={r.k} style={styles.lineRow}>
                  <Text style={styles.lineKey}>{r.k}</Text>
                  <Text style={styles.lineValue}>{r.v}</Text>
                </View>
              ))}
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{info}</Text>
            </View>
            {doc.status === "rejected" && doc.rejectionReason ? (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>{t("rv.alasan")}</Text>
                <Text style={styles.reasonText}>{doc.rejectionReason}</Text>
              </View>
            ) : null}
            {doc.status === "changeRequested" && doc.changeReason ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>{t("dk.alasanMu")}</Text>
                <Text style={styles.noteText}>{doc.changeReason}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {isVerified || canChange ? (
          <View
            style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}
          >
            {/* Alasan ada di bar yang menempel di atas keyboard, jadi tidak tertutup. */}
            {isRequesting ? (
              <>
                <Text style={styles.barLabel}>{t("dk.ubahJudul")}</Text>
                <TextInput
                  style={styles.textarea}
                  value={reason}
                  onChangeText={setReason}
                  placeholder={t("dk.ubahContoh")}
                  placeholderTextColor={c.mutedLabel}
                  multiline
                  autoFocus
                />
              </>
            ) : null}
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
            <View style={styles.btnRow}>
              {isVerified && isRequesting ? (
                <>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => {
                      setIsRequesting(false);
                      setErrorMessage(null);
                    }}
                  >
                    <Text style={styles.secondaryText}>{t("umum.batal")}</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 2 }}
                    disabled={isSending}
                    onPress={submitChange}
                  >
                    <LinearGradient
                      colors={[c.accent, c.accent2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.primaryBtn}
                    >
                      <Text style={styles.primaryText}>
                        {isSending ? t("umum.memproses") : t("dk.kirimUbah")}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : isVerified ? (
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => setIsRequesting(true)}
                >
                  <LinearGradient
                    colors={[c.accent, c.accent2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryText}>{t("dk.ubah")}</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  style={{ flex: 1 }}
                  disabled={isSending}
                  onPress={swap}
                >
                  <LinearGradient
                    colors={[c.accent, c.accent2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryText}>
                      {isSending ? t("umum.memproses") : t("dk.ganti")}
                    </Text>
                  </LinearGradient>
                </Pressable>
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
    badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: "700" },
    content: { paddingHorizontal: 18, paddingBottom: 40 },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
    },
    lineRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    lineKey: { fontSize: 12, fontWeight: "500", color: c.muted },
    lineValue: {
      flex: 1,
      textAlign: "right",
      fontSize: 12,
      fontWeight: "600",
      color: c.ink,
    },
    infoBox: {
      marginTop: 14,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.info.bg,
    },
    infoText: {
      fontSize: 12,
      fontWeight: "500",
      color: c.info.ink,
      lineHeight: 18,
    },
    reasonBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.bad.bg,
    },
    reasonLabel: { fontSize: 10.5, fontWeight: "700", color: c.bad.ink },
    reasonText: {
      fontSize: 12,
      fontWeight: "500",
      color: c.bad.ink,
      marginTop: 4,
    },
    noteBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.chip,
    },
    noteLabel: { fontSize: 10.5, fontWeight: "700", color: c.muted },
    noteText: { fontSize: 12, fontWeight: "500", color: c.ink, marginTop: 4 },
    actionBar: {
      paddingHorizontal: 18,
      paddingTop: 12,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    barLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: c.ink,
      marginBottom: 8,
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
    primaryBtn: {
      ...primaryButtonStyle(c),
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    primaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
