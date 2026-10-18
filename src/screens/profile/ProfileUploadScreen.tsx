import { holdLock } from "@/services/biometric";
import type { ScreenProps } from "@/navigation/types";
import { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
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

import {
  Palette,
  secondaryButtonStyle,
  primaryButtonStyle,
} from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { DocCategory } from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { DateSheet } from "@/components/DateSheet";
import { formatShortDateWithYear } from "@/utils/date";
import { DOC_CATEGORY_LABEL } from "@/constants/statusLabels";
import {
  MAX_BYTES,
  extensionOf,
  withoutExtension,
  formatFileSize,
} from "@/utils/file";
import { useConfirm } from "@/components/ConfirmDialog";
import { useT } from "@/i18n";
import type { Kunci } from "@/i18n/id";
import { goBackAnimated } from "@/navigation/navigationBack";

const CATEGORIES: DocCategory[] = ["kontrak", "sk", "sertifikat", "identitas"];

const SAMPLE: Record<DocCategory, Kunci> = {
  kontrak: "up.cKontrak",
  sk: "up.cSk",
  sertifikat: "up.cSertifikat",
  identitas: "up.cIdentitas",
};

interface FileEntry {
  name: string;
  ext: string;
  size: number;
  uri: string;
  mimeType: string;
}

export function ProfileUploadScreen({ navigation }: ScreenProps) {
  const t = useT();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [categoryKey, setCategoryKey] = useState<DocCategory>("sertifikat");
  const [pickedFile, setPickedFile] = useState<FileEntry | null>(null);
  const [nama, setNama] = useState("");
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const confirm = useConfirm();

  // Satu pintu untuk kedua sumber file, supaya aturan ukuran dan penamaan
  // otomatis tidak ditulis dua kali.
  const accept = (f: FileEntry) => {
    if (f.size > MAX_BYTES) {
      void confirm({
        title: t("up.besarJudul"),
        message: t("up.besarPesan", { ukuran: formatFileSize(f.size) }),
        tone: "warn",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      return;
    }
    setPickedFile(f);
    if (!nama.trim()) setNama(withoutExtension(f.name));
  };

  const pickFile = async () => {
    holdLock();
    const r = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    accept({
      name: a.name,
      ext: extensionOf(a.name),
      size: a.size ?? 0,
      uri: a.uri,
      mimeType: a.mimeType ?? "application/octet-stream",
    });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      void confirm({
        title: t("up.izinJudul"),
        message: t("up.izinPesan"),
        tone: "warn",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      return;
    }
    holdLock();
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (r.canceled) return;
    const a = r.assets[0];
    accept({
      name: a.fileName ?? t("up.fotoNama", { n: Date.now() }),
      ext: "JPG",
      size: a.fileSize ?? 0,
      uri: a.uri,
      mimeType: a.mimeType ?? "image/jpeg",
    });
  };

  const blockMsg = !pickedFile
    ? t("up.blokFile")
    : !nama.trim()
      ? t("up.blokNama")
      : "";
  const canUpload = !blockMsg && !isSending;

  const uploadPickedFile = async () => {
    if (!employee || !pickedFile || !canUpload) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.uploadDocument(employee.id, {
        category: categoryKey,
        ext: pickedFile.ext,
        name: nama.trim(),
        sizeLabel: formatFileSize(pickedFile.size),
        expiresOn: validUntil ?? undefined,
        file: {
          uri: pickedFile.uri,
          name: pickedFile.name,
          mimeType: pickedFile.mimeType,
        },
      });
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };

  const isPdf = pickedFile?.ext === "PDF";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackAnimated(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("up.judul")}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("up.jenis")}</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((k) => {
                const isOn = categoryKey === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setCategoryKey(k)}
                    style={[styles.chip, isOn && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                      {DOC_CATEGORY_LABEL[k]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("up.file")}</Text>

            {pickedFile ? (
              <View style={styles.fileBox}>
                <View
                  style={[
                    styles.extChip,
                    { backgroundColor: isPdf ? c.bad.bg : c.info.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.extText,
                      { color: isPdf ? c.bad.ink : c.info.ink },
                    ]}
                  >
                    {pickedFile.ext}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {pickedFile.name}
                  </Text>
                  <View style={styles.fileOk}>
                    <LineIcon
                      d={ICON.attendanceRate}
                      color={c.ok.ink}
                      size={13}
                    />
                    <Text style={styles.fileOkText}>
                      {t("up.siap", {
                        ukuran: formatFileSize(pickedFile.size),
                      })}
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={styles.removeBtn}
                  onPress={() => setPickedFile(null)}
                >
                  <Text style={styles.removeText}>{t("up.hapus")}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.dropBox}>
                <View style={styles.dropIcon}>
                  <LineIcon d={ICON.upload} color={c.info.ink} size={22} />
                </View>
                <Text style={styles.dropTitle}>{t("up.pilihUntuk")}</Text>
                <Text style={styles.dropSub}>{t("up.format")}</Text>
                <View style={styles.dropActions}>
                  <Pressable style={styles.primarySmall} onPress={pickFile}>
                    <Text style={styles.primarySmallText}>
                      {t("up.pilihFile")}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.secondarySmall} onPress={takePhoto}>
                    <Text style={styles.secondarySmallText}>
                      {t("up.ambilFoto")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("up.detail")}</Text>

            <Text style={styles.label}>{t("up.namaDok")}</Text>
            <TextInput
              style={styles.input}
              value={nama}
              onChangeText={setNama}
              placeholder={t(SAMPLE[categoryKey])}
              placeholderTextColor={c.mutedLabel}
            />

            <Text style={styles.label}>{t("up.berlaku")}</Text>
            <Pressable
              style={styles.dateField}
              onPress={() => {
                Keyboard.dismiss();
                setIsDatePickerOpen(true);
              }}
            >
              <Text
                style={[styles.dateText, !validUntil && styles.datePlaceholder]}
              >
                {validUntil
                  ? formatShortDateWithYear(validUntil)
                  : t("up.pilihTgl")}
              </Text>
              <LineIcon d={ICON.calendar} color={c.muted} size={17} />
            </Pressable>

            <View style={styles.infoBox}>
              <LineIcon d={ICON.info} color={c.info.ink} size={16} />
              <Text style={styles.infoText}>{t("up.info")}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              styles.barLabel,
              blockMsg || errorMessage ? { color: c.bad.ink } : null,
            ]}
          >
            {blockMsg || errorMessage || DOC_CATEGORY_LABEL[categoryKey]}
          </Text>
          <Text style={styles.barValue} numberOfLines={1}>
            {pickedFile ? nama.trim() || pickedFile.name : t("up.belumFile")}
          </Text>
        </View>
        <Pressable onPress={uploadPickedFile} disabled={!canUpload}>
          <View
            style={[
              styles.uploadBtn,
              { backgroundColor: canUpload ? c.accent : c.track },
            ]}
          >
            <Text
              style={[styles.uploadText, canUpload ? { color: "#fff" } : null]}
            >
              {isSending ? t("up.mengunggah") : t("up.unggah")}
            </Text>
          </View>
        </Pressable>
      </View>
      <DateSheet
        visible={isDatePickerOpen}
        title={t("up.berlakuJudul")}
        hint={t("up.berlakuHint")}
        value={validUntil}
        allow="future"
        onPick={setValidUntil}
        onClear={() => setValidUntil(null)}
        onClose={() => setIsDatePickerOpen(false)}
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
      ...primaryButtonStyle(c),
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
      ...secondaryButtonStyle(c),
      alignItems: "center",
    },
    secondarySmallText: {
      fontSize: 12,
      fontWeight: "700",
      color: c.btnSoftInk,
    },

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
