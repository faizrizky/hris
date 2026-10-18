import React, { useCallback, useMemo, useState } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
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
import { useFocusEffect } from "@react-navigation/native";
import { useSession } from "@/services/session";
import { useActivePolling } from "@/hooks/useActivePolling";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Palette,
  secondaryButtonStyle,
  primaryButtonStyle,
} from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { EmployeeDocument } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  DOC_CATEGORY_LABEL,
  DOC_STATUS_LABEL,
  DOC_STATUS_TONE,
} from "@/constants/statusLabels";
import { formatShortDateWithYear } from "@/utils/date";
import { pickProof } from "@/utils/pickProof";
import { useT } from "@/i18n";
import { DocPreview } from "./DocPreview";
import { goBackAnimated } from "@/navigation/navigationBack";

// Karyawan: pratinjau dokumennya sendiri. Dokumen terverifikasi tidak bisa
// diubah langsung; yang bisa dilakukan adalah mengajukan perubahan dengan alasan.
// Dokumen yang menunggu atau ditolak boleh langsung diganti berkasnya.
export function EmployeeDocumentDetailScreen({
  navigation,
  route,
}: ScreenProps) {
  const { employee } = useSession();
  // Salinan dari layar sebelumnya; diperbarui berkala supaya status yang diubah HR langsung tampil.
  const [doc, setDoc] = useState<EmployeeDocument>(
    getRouteParams<{ doc: EmployeeDocument }>(route).doc,
  );
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();

  const [isRequesting, setIsRequesting] = useState(false);
  const [reason, setReason] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!employee) return;
    hrisApi
      .getDocuments(employee.id)
      .then((list) => {
        const baru = list.find((x) => x.id === doc.id);
        if (baru) setDoc(baru);
      })
      .catch(() => {});
  }, [employee, doc.id]);
  useFocusEffect(refresh);
  // Polling hanya selagi status belum final (menunggu / diminta ubah) dan layar aktif di depan.
  useActivePolling(
    refresh,
    20_000,
    doc.status === "pending" || doc.status === "changeRequested",
  );

  const isVerified = doc.status === "verified" || doc.status === "expiring";
  const canChange = doc.status === "pending" || doc.status === "rejected";
  const tone = c[DOC_STATUS_TONE[doc.status]];

  const submitChange = async () => {
    if (!reason.trim()) {
      setErrorMessage(t("dk.alasanWajib"));
      return;
    }
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.requestDocumentChange(doc.id, reason.trim());
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };

  const swap = async () => {
    const r = await pickProof();
    if (!r) return;
    if ("tooLargeSizeLabel" in r) {
      setErrorMessage(t("up.besarPesan", { ukuran: r.tooLargeSizeLabel }));
      return;
    }
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.replaceDocumentFile(doc.id, {
        uri: r.file.uri,
        name: r.file.name,
        mimeType: r.file.mimeType,
      });
      await confirm({
        title: t("dk.judul"),
        message: t("dk.gantiBerhasil"),
        tone: "info",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };

  const info = isVerified
    ? t("dk.terverifikasiInfo")
    : doc.status === "changeRequested"
      ? t("dk.menungguHr")
      : doc.status === "rejected"
        ? t("dk.ditolakInfo")
        : t("dk.pendingInfo");

  const baris = [
    { k: t("rv.kategori"), v: DOC_CATEGORY_LABEL[doc.category] },
    { k: t("rv.ukuran"), v: `${doc.ext} · ${doc.sizeLabel}` },
    {
      k: t("rv.tglUnggah"),
      v: doc.uploadedOn ? formatShortDateWithYear(doc.uploadedOn) : "—",
    },
    {
      k: t("rv.berlaku"),
      v: doc.expiresOn ? formatShortDateWithYear(doc.expiresOn) : "—",
    },
  ];

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
