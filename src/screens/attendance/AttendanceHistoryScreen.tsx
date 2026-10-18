import { useMemo } from "react";
import { usePagedList } from "@/hooks/usePagedList";
import { searchableText } from "@/utils/searchText";
import { ListSearchBar } from "@/components/ListSearchBar";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import type { ScreenProps } from "@/navigation/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealFlatList as FlatList } from "@/components/Reveal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DonutChart } from "@/components/DonutChart";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Skeleton";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ErrorState } from "@/components/ErrorState";
import {
  ATTENDANCE_STATUS_LABEL as STATUS_LABEL,
  ATTENDANCE_STATUS_TONE as STATUS_TONE,
} from "@/constants/statusLabels";
import { getWeekdayName, formatNumericDate, getShortMonth } from "@/utils/date";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";

export function AttendanceHistoryScreen({ navigation }: ScreenProps) {
  const {
    history,
    records,
    filter,
    setFilter,
    isHistoryLoading,
    presentCount,
    lateMinutes,
    permission,
    percent,
    filtered,
    chips,
  } = useAttendanceHistory();
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const paged = usePagedList(filtered, searchableText);
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackAnimated(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("ab.hTitle")}</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.exportBtn}>
          <Text style={styles.exportText}>{t("ab.export")}</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {chips.map((c) => {
          const isOn = filter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              style={[styles.chip, isOn && styles.chipOn]}
            >
              <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={paged.visibleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.recapCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recapLabel}>{t("ab.rekap")}</Text>
                <View style={styles.recapRow}>
                  {isHistoryLoading ? (
                    ["hadir", "telat", "izin", "alpha"].map((l) => (
                      <View key={l} style={{ gap: 6 }}>
                        <Skeleton width={26} height={20} radius={6} />
                        <Skeleton width={30} height={9} radius={4} />
                      </View>
                    ))
                  ) : (
                    <>
                      <Recap
                        value={presentCount}
                        label={t("st.hadir")}
                        color={c.ink}
                      />
                      <Recap
                        value={lateMinutes}
                        label={t("st.telat")}
                        color={c.warn.ink}
                      />
                      <Recap
                        value={permission}
                        label={t("st.izin")}
                        color={c.info.ink}
                      />
                      <Recap
                        value={0}
                        label={t("ab.alpha")}
                        color={c.bad.ink}
                      />
                    </>
                  )}
                </View>
              </View>

              {isHistoryLoading ? (
                <Skeleton width={70} height={70} radius={35} />
              ) : (
                <DonutChart
                  size={70}
                  stroke={11}
                  segments={[
                    { value: presentCount, color: c.accent },
                    { value: lateMinutes, color: c.warn.ink },
                    { value: permission, color: c.accentLight },
                  ]}
                >
                  <Text style={styles.donutText}>{percent}</Text>
                </DonutChart>
              )}
            </View>

            <ListSearchBar
              value={paged.query}
              onChangeText={paged.changeQuery}
            />
          </>
        }
        ListFooterComponent={
          paged.hasMore ? (
            <LoadMoreButton
              remainingCount={paged.remainingCount}
              onPress={paged.loadMore}
            />
          ) : null
        }
        ListEmptyComponent={
          history.error && !records ? (
            <ErrorState message={history.error} onRetry={history.retry} />
          ) : isHistoryLoading ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.row}>
                  <Skeleton width={40} height={40} radius={13} />
                  <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                    <Skeleton width="42%" height={12} radius={4} />
                    <Skeleton width="76%" height={10} radius={4} />
                  </View>
                  <Skeleton width={54} height={20} radius={8} />
                </View>
              ))}
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.dateChip}>
              <Text style={styles.dateDay}>{formatNumericDate(item.date)}</Text>
              <Text style={styles.dateMonth}>{getShortMonth(item.date)}</Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.dow}>{getWeekdayName(item.date)}</Text>
              <Text style={styles.detail}>
                {item.checkIn ?? "—"} — {item.checkOut ?? "—"} ·{" "}
                {item.durationLabel ?? "—"}
              </Text>
            </View>

            <StatusBadge
              label={STATUS_LABEL[item.status]}
              tone={STATUS_TONE[item.status]}
              variant="compact"
            />
          </View>
        )}
      />
    </View>
  );
}

function Recap({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View>
      <Text style={[styles.recapValue, { color }]}>{value}</Text>
      <Text style={styles.recapCaption}>{label}</Text>
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
    exportBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.accent,
    },
    exportText: { fontSize: 11.5, fontWeight: "600", color: "#fff" },

    chipRow: {
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 18,
      paddingBottom: 14,
    },
    chip: {
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: c.chip,
    },
    chipOn: { backgroundColor: c.accent },
    chipText: { fontSize: 12, fontWeight: "600", color: c.muted },
    chipTextOn: { color: "#fff" },

    list: { paddingHorizontal: 18, paddingBottom: 170 },

    recapCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: 16,
      marginBottom: 14,
    },
    recapLabel: { fontSize: 11, fontWeight: "500", color: c.muted },
    recapRow: { flexDirection: "row", gap: 16, marginTop: 10 },
    recapValue: { fontSize: 20, lineHeight: 21, fontWeight: "800" },
    recapCaption: {
      fontSize: 10,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },

    donutText: { fontSize: 12, fontWeight: "800", color: c.ink },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingVertical: 14,
      paddingHorizontal: 15,
      marginBottom: 10,
    },
    dateChip: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    dateDay: {
      fontSize: 14,
      lineHeight: 15,
      fontWeight: "800",
      color: c.ink,
    },
    dateMonth: {
      fontSize: 8,
      fontWeight: "600",
      color: c.muted,
      marginTop: 2,
    },
    dow: { fontSize: 13, fontWeight: "600", color: c.ink },
    detail: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },
  });
