import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { ReviewDocument, ReviewStatus } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { DOC_CATEGORY_LABEL } from "@/constants/statusLabels";
import { tanggalPendekTahun } from "@/utils/date";
import { useT } from "@/i18n";
import type { Kunci } from "@/i18n/id";

const FILTER: { key: ReviewStatus; label: Kunci }[] = [
  { key: "Pending", label: "rv.menunggu" },
  { key: "Verified", label: "rv.diverifikasi" },
  { key: "Rejected", label: "rv.ditolak" },
];

// HR: daftar Dokumen Digital karyawan yang perlu (atau sudah) diverifikasi.
export function DocumentReviewScreen({ navigation }: any) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [status, setStatus] = useState<ReviewStatus>("Pending");

  const dok = useLoad(() => hrisApi.getDocumentsForReview(status), status);
  const items = dok.data ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>{t("rv.judul")}</Text>
          <Text style={styles.headerSub}>{t("rv.sub")}</Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {FILTER.map((f) => {
          const on = status === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setStatus(f.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t(f.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {dok.error && !dok.data ? (
          <ErrorState pesan={dok.error} onUlangi={dok.ulangi} />
        ) : dok.memuat ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.row}>
                <Skeleton width={44} height={44} radius={13} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton width="62%" height={12} radius={4} />
                  <Skeleton width="84%" height={10} radius={4} />
                </View>
              </View>
            ))}
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t("rv.kosongJudul")}</Text>
            <Text style={styles.emptyText}>{t("rv.kosongIsi")}</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                onPress={() =>
                  navigation.navigate("DocumentReviewDetail", { doc: d })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DocRow({
  doc,
  onPress,
}: {
  doc: ReviewDocument;
  onPress: () => void;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const pdf = doc.ext === "PDF";
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View
        style={[
          styles.extChip,
          { backgroundColor: pdf ? c.bad.bg : c.info.bg },
        ]}
      >
        <Text style={[styles.extText, { color: pdf ? c.bad.ink : c.info.ink }]}>
          {doc.ext}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {doc.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {doc.employeeName} · {DOC_CATEGORY_LABEL[doc.category]}
        </Text>
        <Text style={styles.meta}>
          {doc.uploadedOn
            ? t("rv.diunggah", { tgl: tanggalPendekTahun(doc.uploadedOn) })
            : "—"}
          {doc.fileUrl ? "" : ` · ${t("rv.tanpaFile")}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={c.mutedLabel} />
    </Pressable>
  );
}

export const makeStyles = (c: Palette) =>
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
    chipRow: {
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 18,
      marginBottom: 12,
    },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 11.5, fontWeight: "600", color: c.muted },
    chipTextOn: { color: "#fff" },
    list: { paddingHorizontal: 18, paddingBottom: 130 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    extChip: {
      width: 44,
      height: 44,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    extText: { fontSize: 10.5, fontWeight: "800" },
    name: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    meta: { fontSize: 11, fontWeight: "500", color: c.muted, marginTop: 3 },
    emptyCard: {
      alignItems: "center",
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    emptyTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    emptyText: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.muted,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 6,
    },
  });
