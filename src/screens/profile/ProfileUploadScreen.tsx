import { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { DocCategory } from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { DateSheet } from "@/components/DateSheet";
import { tanggalPendekTahun } from "@/utils/date";
import { DOC_CATEGORY_LABEL } from "@/constants/statusLabels";
import {
  MAKS_BYTE,
  ekstensiDari,
  tanpaEkstensi,
  ukuranFile,
} from "@/utils/file";
import { useConfirm } from "@/components/ConfirmDialog";

const KATEGORI: DocCategory[] = ["kontrak", "sk", "sertifikat", "identitas"];

const CONTOH: Record<DocCategory, string> = {
  kontrak: "mis. Kontrak Kerja PKWTT",
  sk: "mis. SK Kenaikan Jabatan",
  sertifikat: "mis. Sertifikat Brevet Pajak",
  identitas: "mis. KTP",
};

interface Berkas {
  name: string;
  ext: string;
  size: number;
}

export function ProfileUploadScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [kategori, setKategori] = useState<DocCategory>("sertifikat");
  const [berkas, setBerkas] = useState<Berkas | null>(null);
  const [nama, setNama] = useState("");
  const [berlaku, setBerlaku] = useState<string | null>(null);
  const [pickTanggal, setPickTanggal] = useState(false);
  const [sending, setSending] = useState(false);
  const confirm = useConfirm();

  // Satu pintu untuk kedua sumber file, supaya aturan ukuran dan penamaan
  // otomatis tidak ditulis dua kali.
  const terima = (f: Berkas) => {
    if (f.size > MAKS_BYTE) {
      void confirm({
        title: "File terlalu besar",
        message: `Ukuran ${ukuranFile(f.size)} melebihi batas 5 MB.`,
        tone: "warn",
        confirmText: "Mengerti",
        cancelText: null,
      });
      return;
    }
    setBerkas(f);
    if (!nama.trim()) setNama(tanpaEkstensi(f.name));
  };

  const pilihFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    terima({
      name: a.name,
      ext: ekstensiDari(a.name),
      size: a.size ?? 0,
    });
  };

  const ambilFoto = async () => {
    const izin = await ImagePicker.requestCameraPermissionsAsync();
    if (!izin.granted) {
      void confirm({
        title: "Izin kamera ditolak",
        message:
          "Aktifkan izin kamera di pengaturan untuk mengambil foto dokumen.",
        tone: "warn",
        confirmText: "Mengerti",
        cancelText: null,
      });
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (r.canceled) return;
    const a = r.assets[0];
    terima({
      name: a.fileName ?? `foto-dokumen-${Date.now()}.jpg`,
      ext: "JPG",
      size: a.fileSize ?? 0,
    });
  };

  const blockMsg = !berkas
    ? "File belum dipilih"
    : !nama.trim()
      ? "Nama dokumen belum diisi"
      : "";
  const bisaUnggah = !blockMsg && !sending;

  const unggah = async () => {
    if (!employee || !berkas || !bisaUnggah) return;
    setSending(true);
    try {
      await hrisApi.uploadDocument(employee.id, {
        category: kategori,
        ext: berkas.ext,
        name: nama.trim(),
        sizeLabel: ukuranFile(berkas.size),
        expiresLabel: berlaku ? tanggalPendekTahun(berlaku) : undefined,
      });
      navigation.goBack();
    } finally {
      setSending(false);
    }
  };

  const pdf = berkas?.ext === "PDF";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Unggah Dokumen</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Jenis dokumen</Text>
            <View style={styles.chipRow}>
              {KATEGORI.map((k) => {
                const on = kategori === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKategori(k)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {DOC_CATEGORY_LABEL[k]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>File</Text>

            {berkas ? (
              <View style={styles.fileBox}>
                <View
                  style={[
                    styles.extChip,
                    { backgroundColor: pdf ? c.bad.bg : c.info.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.extText,
                      { color: pdf ? c.bad.ink : c.info.ink },
                    ]}
                  >
                    {berkas.ext}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {berkas.name}
                  </Text>
                  <View style={styles.fileOk}>
                    <LineIcon
                      d={ICON.attendanceRate}
                      color={c.ok.ink}
                      size={13}
                    />
                    <Text style={styles.fileOkText}>
                      {ukuranFile(berkas.size)} · siap diunggah
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={styles.removeBtn}
                  onPress={() => setBerkas(null)}
                >
                  <Text style={styles.removeText}>Hapus</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.dropBox}>
                <View style={styles.dropIcon}>
                  <LineIcon d={ICON.upload} color={c.info.ink} size={22} />
                </View>
                <Text style={styles.dropTitle}>Pilih file untuk diunggah</Text>
                <Text style={styles.dropSub}>
                  PDF, JPG, atau PNG · maks. 5 MB
                </Text>
                <View style={styles.dropActions}>
                  <Pressable style={styles.primarySmall} onPress={pilihFile}>
                    <Text style={styles.primarySmallText}>Pilih file</Text>
                  </Pressable>
                  <Pressable style={styles.secondarySmall} onPress={ambilFoto}>
                    <Text style={styles.secondarySmallText}>Ambil foto</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>Detail dokumen</Text>

            <Text style={styles.label}>Nama dokumen</Text>
            <TextInput
              style={styles.input}
              value={nama}
              onChangeText={setNama}
              placeholder={CONTOH[kategori]}
              placeholderTextColor={c.mutedLabel}
            />

            <Text style={styles.label}>Berlaku sampai (opsional)</Text>
            <Pressable
              style={styles.dateField}
              onPress={() => {
                Keyboard.dismiss();
                setPickTanggal(true);
              }}
            >
              <Text
                style={[styles.dateText, !berlaku && styles.datePlaceholder]}
              >
                {berlaku ? tanggalPendekTahun(berlaku) : "Pilih tanggal"}
              </Text>
              <LineIcon d={ICON.calendar} color={c.muted} size={17} />
            </Pressable>

            <View style={styles.infoBox}>
              <LineIcon d={ICON.info} color={c.info.ink} size={16} />
              <Text style={styles.infoText}>
                Dokumen diverifikasi HR dalam 1–2 hari kerja. Kamu akan mendapat
                notifikasi setelah selesai.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.barLabel, blockMsg ? { color: c.bad.ink } : null]}
          >
            {blockMsg || DOC_CATEGORY_LABEL[kategori]}
          </Text>
          <Text style={styles.barValue} numberOfLines={1}>
            {berkas ? nama.trim() || berkas.name : "Belum ada file"}
          </Text>
        </View>
        <Pressable onPress={unggah} disabled={!bisaUnggah}>
          <View
            style={[
              styles.uploadBtn,
              { backgroundColor: bisaUnggah ? c.accent : c.track },
            ]}
          >
            <Text
              style={[styles.uploadText, bisaUnggah ? { color: "#fff" } : null]}
            >
              {sending ? "Mengunggah..." : "Unggah"}
            </Text>
          </View>
        </Pressable>
      </View>
      <DateSheet
        visible={pickTanggal}
        title="Berlaku sampai"
        hint="Pilih tanggal kedaluwarsa dokumen"
        value={berlaku}
        allow="future"
        onPick={setBerlaku}
        onClear={() => setBerlaku(null)}
        onClose={() => setPickTanggal(false)}
      />
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
      paddingBottom: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
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

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },

    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },

    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 12, fontWeight: "600", color: c.muted },
    chipTextOn: { color: "#fff" },

    dropBox: {
      alignItems: "center",
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.fieldBorder,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 22,
      marginTop: 12,
    },
    dropIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    dropTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.ink,
      marginTop: 12,
    },
    dropSub: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },
    dropActions: {
      flexDirection: "row",
      gap: 9,
      marginTop: 14,
      width: "100%",
    },
    primarySmall: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 13,
      backgroundColor: c.accent,
      alignItems: "center",
    },
    primarySmallText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    secondarySmall: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 13,
      backgroundColor: c.chip,
      alignItems: "center",
    },
    secondarySmallText: { fontSize: 12, fontWeight: "700", color: c.ink },

    fileBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 16,
      backgroundColor: c.chip,
      padding: 12,
      marginTop: 12,
    },
    extChip: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    extText: { fontSize: 10.5, fontWeight: "700" },
    fileName: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    fileOk: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 4,
    },
    fileOkText: { fontSize: 10.5, fontWeight: "600", color: c.ok.ink },
    removeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: c.bad.bg,
    },
    removeText: { fontSize: 11, fontWeight: "700", color: c.bad.ink },

    label: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.mutedLabel,
      marginTop: 14,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 13.5,
      fontWeight: "500",
      color: c.ink,
    },
    dateField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 13,
    },
    dateText: { fontSize: 13.5, fontWeight: "600", color: c.ink },
    datePlaceholder: { fontWeight: "500", color: c.mutedLabel },

    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: 14,
      backgroundColor: c.info.bg,
      paddingHorizontal: 13,
      paddingVertical: 11,
      marginTop: 14,
    },
    infoText: {
      flex: 1,
      fontSize: 11.5,
      lineHeight: 17,
      fontWeight: "600",
      color: c.info.ink,
    },

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
    barLabel: { fontSize: 10.5, fontWeight: "500", color: c.muted },
    barValue: {
      fontSize: 14,
      fontWeight: "800",
      color: c.ink,
      marginTop: 3,
    },
    uploadBtn: {
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 16,
    },
    uploadText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
