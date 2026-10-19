import { useMemo } from "react";
import { usePagedList } from "@/hooks/usePagedList";
import { searchableText } from "@/utils/searchText";
import { ListSearchBar } from "@/components/ListSearchBar";
import { PagedItems } from "@/components/PagedItems";
import { type ScreenProps } from "@/navigation/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ReviewDocument, ReviewStatus } from "@/services/types";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { DOC_CATEGORY_LABEL } from "@/constants/statusLabels";
import { formatShortDateWithYear } from "@/utils/date";
import { useT } from "@/i18n";
import { EmptyState } from "@/components/EmptyState";
import { ICON } from "@/constants/icons";
import type { TranslationKey } from "@/i18n/id";
import { goBackAnimated } from "@/navigation/navigationBack";
import { useDocumentReview } from "@/hooks/useDocumentReview";

const FILTER: { key: ReviewStatus | "all"; label: TranslationKey }[] = [
  { key: "all", label: "rv.semua" },
  { key: "Pending", label: "rv.menunggu" },
  { key: "Verified", label: "rv.diverifikasi" },
  { key: "Rejected", label: "rv.ditolak" },
  { key: "Change Requested", label: "rv.perubahan" },
];

// HR: daftar Dokumen Digital karyawan yang perlu (atau sudah) diverifikasi.
export function DocumentReviewScreen({ navigation, route }: ScreenProps) {
  const { status, setStatus, documentItem, items } = useDocumentReview({
    route,
  });
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Dibuka lagi dari notifikasi lain saat layar sudah terpasang: ikuti konteks barunya.
  const paged = usePagedList(items, searchableText);
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
          <Text style={styles.headerTitle}>{t("rv.judul")}</Text>
          <Text style={styles.headerSub}>{t("rv.sub")}</Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {FILTER.map((f) => {
          const isOn = status === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setStatus(f.key)}
              style={[styles.chip, isOn && styles.chipOn]}
            >
              <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                {t(f.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {items.length > 0 ? (
        <ListSearchBar
          inset
          value={paged.query}
          onChangeText={paged.changeQuery}
        />
      ) : null}
      <ScrollView contentContainerStyle={styles.list}>
        {documentItem.error && !documentItem.data ? (
          <ErrorState
            message={documentItem.error}
            onRetry={documentItem.retry}
          />
        ) : documentItem.isLoading ? (
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
          <EmptyState
            icon={ICON.document}
            title={t("rv.kosongJudul")}
            text={t("rv.kosongIsi")}
          />
        ) : (
          <PagedItems
            paged={paged}
            renderItem={(d) => (
              <DocRow
                key={d.id}
                doc={d}
                onPress={() =>
                  navigation.navigate("DocumentReviewDetail", { doc: d })
                }
              />
            )}
          />
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
  const isPdf = doc.ext === "PDF";
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View
        style={[
          styles.extChip,
          { backgroundColor: isPdf ? c.bad.bg : c.info.bg },
        ]}
      >
        <Text
          style={[styles.extText, { color: isPdf ? c.bad.ink : c.info.ink }]}
        >
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
            ? t("rv.diunggah", { tgl: formatShortDateWithYear(doc.uploadedOn) })
            : "—"}
          {doc.fileUrl ? "" : ` · ${t("rv.tanpaFile")}`}
        </Text>
      </View>
      {doc.status !== "Pending" && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: doc.status === "Verified" ? c.ok.bg : c.bad.bg,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color:
                  doc.status === "Verified"
                    ? c.ok.ink
                    : doc.status === "Rejected"
                      ? c.bad.ink
                      : c.warn.ink,
              },
            ]}
          >
            {t(
              doc.status === "Verified"
                ? "rv.diverifikasi"
                : doc.status === "Rejected"
                  ? "rv.ditolak"
                  : "rv.perubahan",
            )}
          </Text>
        </View>
      )}
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
    list: { paddingHorizontal: 18, paddingBottom: 170 },
    row: {
      marginBottom: 10,
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
    badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: "700" },
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
