import { useMemo } from "react";
import { usePagedList } from "@/hooks/usePagedList";
import { searchableText } from "@/utils/searchText";
import { ListSearchBar } from "@/components/ListSearchBar";
import { PagedItems } from "@/components/PagedItems";
import type { ScreenProps } from "@/navigation/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ErrorState } from "@/components/ErrorState";
import { useT } from "@/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { ICON } from "@/constants/icons";
import {
  OVERTIME_STATUS_LABEL,
  OVERTIME_STATUS_TONE,
} from "@/constants/statusLabels";
import { OVERTIME_LIMIT_HOURS } from "@/constants/payroll";
import { rupiah } from "@/utils/currency";
import {
  formatShortDuration,
  formatHoursMinutes,
  getMonthName,
  getWeekdayName,
  formatShortDateWithYear,
} from "@/utils/date";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { goBackAnimated } from "@/navigation/navigationBack";
import { useOvertime } from "@/hooks/useOvertime";

export function OvertimeScreen({ navigation }: ScreenProps) {
  const {
    records,
    errorMessage,
    load,
    jam,
    minutes,
    percent,
    estimate,
    isTight,
  } = useOvertime();
  const insets = useSafeAreaInsets();
  // Ringkasan hanya bulan ini. String ISO "2026-09-12" cukup dipotong 7
  // karakter jadi "2026-09" untuk dibandingkan — tidak perlu parse tanggal.
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);

  const paged = usePagedList(records ?? [], searchableText);
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackAnimated(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("ot.judul")}</Text>
      </View>

      {records && records.length > 0 ? (
        <ListSearchBar
          inset
          value={paged.query}
          onChangeText={paged.changeQuery}
        />
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetLabel}>
              {t("ot.totalJam", { bulan: getMonthName() })}
            </Text>
            <View
              style={[
                styles.limitBadge,
                isTight && { backgroundColor: c.warn.bg },
              ]}
            >
              <Text
                style={[styles.limitText, isTight && { color: c.warn.ink }]}
              >
                {t("ot.batas", { n: OVERTIME_LIMIT_HOURS })}
              </Text>
            </View>
          </View>

          <View style={styles.bigRow}>
            {records === null ? (
              <Skeleton width={104} height={32} radius={9} />
            ) : (
              <>
                <Text style={styles.bigValue}>{jam}</Text>
                <Text style={styles.bigUnit}>
                  {t("ot.jam")}
                  {minutes > 0 ? ` ${t("ot.mnt", { n: minutes })}` : ""}
                </Text>
              </>
            )}
          </View>

          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${percent}%`,
                  backgroundColor: isTight ? c.warn.ink : c.accent,
                },
              ]}
            />
          </View>

          <View style={styles.payRow}>
            <Text style={styles.payLabel}>{t("ot.estimasi")}</Text>
            {records === null ? (
              <Skeleton width={96} height={14} radius={5} />
            ) : (
              <Text style={styles.payValue}>{rupiah(estimate)}</Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={() =>
            navigation.navigate("LeaveRequest", {
              kind: "lembur",
              n: Date.now(),
            })
          }
        >
          <LinearGradient
            colors={[c.accent, c.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{t("ot.ajukanBaru")}</Text>
          </LinearGradient>
        </Pressable>

        <Text style={styles.sectionTitle}>{t("ot.riwayat")}</Text>

        {errorMessage && records === null ? (
          <ErrorState message={errorMessage} onRetry={load} />
        ) : records === null ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <OvertimeRowSkeleton key={i} />
            ))}
          </View>
        ) : records.length === 0 ? (
          <EmptyState
            icon={ICON.overtime}
            height={260}
            title={t("ot.kosongJudul")}
            text={t("ot.kosongIsi")}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {
              <PagedItems
                paged={paged}
                gap={10}
                renderItem={(r) => (
                  <View key={r.id} style={styles.row}>
                    <View style={styles.hourChip}>
                      <Text style={styles.hourText}>
                        {formatShortDuration(r.hours)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle}>
                        {formatShortDateWithYear(r.date)} ·{" "}
                        {getWeekdayName(r.date)}
                      </Text>
                      <Text style={styles.rowNote} numberOfLines={1}>
                        {formatHoursMinutes(r.startMinute)}–
                        {formatHoursMinutes(r.endMinute)} · {r.note}
                      </Text>
                    </View>

                    <StatusBadge
                      label={OVERTIME_STATUS_LABEL[r.status]}
                      tone={OVERTIME_STATUS_TONE[r.status]}
                      variant="compact"
                    />
                  </View>
                )}
              />
            }
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function OvertimeRowSkeleton() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.row}>
      <Skeleton width={40} height={40} radius={13} />
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
        <Skeleton width="58%" height={12} radius={4} />
        <Skeleton width="86%" height={10} radius={4} />
      </View>
      <Skeleton width={58} height={20} radius={8} />
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

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 170 },

    sheet: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 18,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    sheetHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    sheetLabel: { fontSize: 11.5, fontWeight: "500", color: c.muted },
    limitBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.info.bg,
    },
    limitText: { fontSize: 10, fontWeight: "700", color: c.info.ink },

    bigRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 7,
      marginTop: 8,
    },
    bigValue: {
      fontSize: 38,
      lineHeight: 40,
      fontWeight: "800",
      letterSpacing: -1.3,
      color: c.ink,
    },
    bigUnit: {
      fontSize: 13,
      fontWeight: "600",
      color: c.muted,
      paddingBottom: 5,
    },

    track: {
      height: 7,
      borderRadius: 4,
      backgroundColor: c.track,
      marginTop: 14,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: 4 },

    payRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
    },
    payLabel: { fontSize: 10.5, fontWeight: "500", color: c.muted },
    payValue: { fontSize: 11.5, fontWeight: "700", color: c.ink },

    cta: {
      ...primaryButtonStyle(c),
      borderRadius: 22,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 12,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 20,
      elevation: 5,
    },
    ctaText: { fontSize: 13.5, fontWeight: "700", color: "#fff" },

    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.ink,
      marginTop: 20,
      marginBottom: 10,
      marginHorizontal: 2,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 15,
    },
    hourChip: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: c.warn.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    hourText: { fontSize: 12, fontWeight: "700", color: c.warn.ink },
    rowTitle: { fontSize: 13, fontWeight: "600", color: c.ink },
    rowNote: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    emptyCard: {
      alignItems: "center",
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 13.5,
      fontWeight: "700",
      color: c.ink,
      marginTop: 14,
    },
    emptyText: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.muted,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 6,
    },
  });
