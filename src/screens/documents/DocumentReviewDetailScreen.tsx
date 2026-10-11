import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView as RNScrollView,
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
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { ReviewDocument } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { DOC_CATEGORY_LABEL } from "@/constants/statusLabels";
import { tanggalPendekTahun } from "@/utils/date";
import { adalahGambar, bukaLampiran, simpanLampiran } from "@/utils/lampiran";
import { useT } from "@/i18n";

// HR: pratinjau satu dokumen lalu memverifikasi atau menolaknya (dengan alasan).
export function DocumentReviewDetailScreen({ navigation, route }: any) {
  const doc: ReviewDocument = route.params.doc;
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();

  const gambar = !!doc.fileUrl && adalahGambar(doc.fileUrl);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [gagalPratinjau, setGagalPratinjau] = useState(false);
  const [tolak, setTolak] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [sending, setSending] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const gulir = useRef<RNScrollView>(null);

  // Gambar diunduh dengan sesi aplikasi lalu ditampilkan dari cache lokal.
  useEffect(() => {
    if (!gambar || !doc.fileUrl) return;
    let batal = false;
    simpanLampiran(doc.fileUrl, doc.fileName ?? doc.name)
      .then((uri) => !batal && setPratinjau(uri))
      .catch(() => !batal && setGagalPratinjau(true));
    return () => {
      batal = true;
    };
  }, [gambar, doc.fileUrl, doc.fileName, doc.name]);

  const buka = async () => {
    if (!doc.fileUrl) return;
    try {
      if (!(await bukaLampiran(doc.fileUrl, doc.fileName ?? doc.name)))
        throw new Error("unavailable");
    } catch {
      void confirm({
        title: t("lamp.gagalJudul"),
        message: t("lamp.gagalPesan"),
        tone: "warn",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
    }
  };

  const putuskan = async (decision: "verify" | "reject") => {
    if (decision === "reject" && !alasan.trim()) {
      setGalat(t("rv.alasanWajib"));
      return;
    }
    if (decision === "verify") {
      const ya = await confirm({
        title: t("rv.verifikasiJudul"),
        message: t("rv.verifikasiPesan", { nama: doc.employeeName }),
        tone: "info",
        confirmText: t("rv.verifikasi"),
        cancelText: t("umum.batal"),
      });
      if (!ya) return;
    }
    setSending(true);
    setGalat(null);
    try {
      await hrisApi.decideDocument(
        doc.id,
        decision,
        alasan.trim() || undefined,
      );
      navigation.goBack();
    } catch (e) {
      setGalat(describeError(e));
    } finally {
      setSending(false);
    }
  };

  const baris = [
    { k: t("rv.karyawan"), v: doc.employeeName },
    {
      k: t("rv.jabatan"),
      v: [doc.designation, doc.department].filter(Boolean).join(" · ") || "—",
    },
    { k: t("rv.kategori"), v: DOC_CATEGORY_LABEL[doc.category] },
    { k: t("rv.ukuran"), v: `${doc.ext} · ${doc.sizeLabel}` },
    {
      k: t("rv.tglUnggah"),
      v: doc.uploadedOn ? tanggalPendekTahun(doc.uploadedOn) : "—",
    },
    {
      k: t("rv.berlaku"),
      v: doc.expiresOn ? tanggalPendekTahun(doc.expiresOn) : "—",
    },
  ];

  const menunggu = doc.status === "Pending";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {doc.name}
          </Text>
          <Text style={styles.headerSub}>{t("rv.judul")}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={gulir}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {!doc.fileUrl ? (
              <View style={styles.previewEmpty}>
                <LineIcon d={ICON.document} color={c.muted} size={26} />
                <Text style={styles.previewText}>{t("rv.tanpaFile")}</Text>
              </View>
            ) : gambar ? (
              pratinjau ? (
                <Pressable onPress={buka}>
                  <Image
                    source={{ uri: pratinjau }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </Pressable>
              ) : gagalPratinjau ? (
                <View style={styles.previewEmpty}>
                  <Text style={styles.previewText}>{t("lamp.gagalJudul")}</Text>
                </View>
              ) : (
                <View style={styles.previewEmpty}>
                  <ActivityIndicator color={c.accent} />
                </View>
              )
            ) : (
              <View style={styles.previewEmpty}>
                <View style={styles.pdfIcon}>
                  <Text style={styles.pdfText}>{doc.ext}</Text>
                </View>
                <Text style={styles.previewText} numberOfLines={1}>
                  {doc.fileName ?? doc.name}
                </Text>
              </View>
            )}
            {doc.fileUrl ? (
              <Pressable style={styles.openBtn} onPress={buka}>
                <Text style={styles.openText}>{t("rv.buka")}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <View style={{ gap: 11 }}>
              {baris.map((r) => (
                <View key={r.k} style={styles.lineRow}>
                  <Text style={styles.lineKey}>{r.k}</Text>
                  <Text style={styles.lineValue}>{r.v}</Text>
                </View>
              ))}
            </View>
            {doc.status === "Rejected" && doc.rejectionReason ? (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>{t("rv.alasan")}</Text>
                <Text style={styles.reasonText}>{doc.rejectionReason}</Text>
              </View>
            ) : null}
          </View>

          {menunggu && tolak ? (
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardTitle}>{t("rv.alasan")}</Text>
              <TextInput
                style={styles.textarea}
                value={alasan}
                onChangeText={setAlasan}
                placeholder={t("rv.alasanContoh")}
                placeholderTextColor={c.mutedLabel}
                multiline
                autoFocus
                // Kolom alasan ada di paling bawah: gulir supaya tidak tertutup keyboard.
                onFocus={() =>
                  setTimeout(
                    () => gulir.current?.scrollToEnd({ animated: true }),
                    250,
                  )
                }
              />
            </View>
          ) : null}
          {galat ? <Text style={styles.galat}>{galat}</Text> : null}
        </ScrollView>
        {menunggu ? (
          <View
            style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}
          >
            {tolak ? (
              <>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setTolak(false);
                    setGalat(null);
                  }}
                >
                  <Text style={styles.secondaryText}>{t("umum.batal")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.rejectBtn, { flex: 2 }]}
                  disabled={sending}
                  onPress={() => putuskan("reject")}
                >
                  <Text style={styles.rejectText}>
                    {sending ? t("umum.memproses") : t("rv.kirimTolak")}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={styles.rejectBtn}
                  onPress={() => setTolak(true)}
                >
                  <Text style={styles.rejectText}>{t("rv.tolak")}</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 2 }}
                  disabled={sending || !doc.fileUrl}
                  onPress={() => putuskan("verify")}
                >
                  <LinearGradient
                    colors={
                      doc.fileUrl ? [c.accent, c.accent2] : [c.track, c.track]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.approveBtn}
                  >
                    <Text style={styles.approveText}>
                      {sending ? t("umum.memproses") : t("rv.verifikasi")}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
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
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    image: { width: "100%", height: 320, borderRadius: 14 },
    previewEmpty: {
      height: 180,
      borderRadius: 14,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 16,
    },
    previewText: { fontSize: 12, fontWeight: "600", color: c.muted },
    pdfIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: c.bad.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    pdfText: { fontSize: 12, fontWeight: "800", color: c.bad.ink },
    openBtn: {
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.info.bg,
      alignItems: "center",
    },
    openText: { fontSize: 12.5, fontWeight: "700", color: c.info.ink },
    lineRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    lineKey: { fontSize: 12, fontWeight: "500", color: c.muted },
    lineValue: {
      flex: 1,
      textAlign: "right",
      fontSize: 12,
      fontWeight: "600",
      color: c.ink,
    },
    reasonBox: {
      marginTop: 14,
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
    textarea: {
      marginTop: 10,
      minHeight: 90,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      padding: 12,
      fontSize: 13,
      color: c.ink,
      textAlignVertical: "top",
    },
    galat: {
      marginTop: 12,
      fontSize: 12,
      fontWeight: "600",
      color: c.bad.ink,
      textAlign: "center",
    },
    actionBar: {
      flexDirection: "row",
      gap: 9,
      paddingHorizontal: 18,
      paddingTop: 12,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.chip,
      alignItems: "center",
    },
    secondaryText: { fontSize: 13, fontWeight: "700", color: c.ink },
    rejectBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.bad.bg,
      alignItems: "center",
    },
    rejectText: { fontSize: 13, fontWeight: "700", color: c.bad.ink },
    approveBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    approveText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
