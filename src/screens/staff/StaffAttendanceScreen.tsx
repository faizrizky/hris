import { useMemo } from "react";
import { PagedList } from "@/components/PagedList";
import type { ScreenProps } from "@/navigation/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SemanticTone, Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ErrorState } from "@/components/ErrorState";
import { Staff, StaffAttendanceState } from "@/services/types";
import { Skeleton } from "@/components/Skeleton";
import { formatLongDate } from "@/utils/date";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/id";
import { EmptyState } from "@/components/EmptyState";
import { ICON } from "@/constants/icons";
import { goBackAnimated } from "@/navigation/navigationBack";
import { useStaffAttendance, ALL_TAB } from "@/hooks/useStaffAttendance";

const TABS: { key: StaffAttendanceState; label: TranslationKey }[] = [
  { key: "attend", label: "stf.tabHadir" },
  { key: "late", label: "stf.tabTelat" },
  { key: "leave", label: "stf.tabCuti" },
  { key: "belum", label: "stf.tabBelum" },
];

const TONE: Record<StaffAttendanceState, SemanticTone> = {
  attend: "ok",
  late: "warn",
  leave: "info",
  belum: "bad",
};

export function StaffAttendanceScreen({ navigation }: ScreenProps) {
  const {
    directory,
    tab,
    setTab,
    departmentFilter,
    setDepartmentFilter,
    errorMessage,
    load,
    isLoading,
    todayKey,
    chips,
    countTab,
    filtered,
  } = useStaffAttendance();
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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
          <Text style={styles.headerTitle}>{t("stf.absensiKry")}</Text>
          <Text style={styles.headerSub}>{formatLongDate()}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tabKey) => {
          const isOn = tab === tabKey.key;
          return (
            <Pressable
              key={tabKey.key}
              onPress={() => setTab(tabKey.key)}
              style={[styles.tab, isOn && styles.tabOn]}
            >
              <Text style={[styles.tabText, isOn && styles.tabTextOn]}>
                {t(tabKey.label)} · {isLoading ? "–" : countTab(tabKey.key)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0, marginBottom: 12 }}
        contentContainerStyle={styles.chipRow}
      >
        {isLoading
          ? [92, 110, 74].map((w, i) => (
              <Skeleton key={i} width={w} height={31} radius={999} />
            ))
          : chips.map((c) => {
              const isOn = departmentFilter === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setDepartmentFilter(c)}
                  style={[styles.chip, isOn && styles.chipOn]}
                >
                  <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                    {c === ALL_TAB ? t("stf.semua") : c}
                  </Text>
                </Pressable>
              );
            })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list}>
        {errorMessage && directory === null ? (
          <ErrorState message={errorMessage} onRetry={load} />
        ) : isLoading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardTop}>
                  <Skeleton width={40} height={40} radius={20} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <Skeleton width="55%" height={12} radius={4} />
                    <Skeleton width="72%" height={10} radius={4} />
                  </View>
                </View>
                <View style={styles.cardDivider} />
                <Skeleton width="100%" height={28} radius={6} />
              </View>
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ICON.attendanceRate}
            title={t("stf.kosongKategori")}
            text={t("stf.kosongKategoriIsi", {
              status: t(
                TABS.find((tabKey) => tabKey.key === tab)!.label,
              ).toLowerCase(),
              dept:
                departmentFilter === ALL_TAB
                  ? ""
                  : t("stf.diDept", { dept: departmentFilter }),
            })}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {
              <PagedList
                gap={10}
                items={filtered}
                renderItem={(s) => (
                  <AttendanceCard
                    key={s.id}
                    staff={s}
                    date={todayKey}
                    onOpen={() =>
                      navigation.navigate("StaffDetail", { staffId: s.id })
                    }
                  />
                )}
              />
            }
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AttendanceCard({
  staff,
  date,
  onOpen,
}: {
  staff: Staff;
  date: string;
  onOpen: () => void;
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const tone = c[TONE[staff.today.state]];
  const isLate = staff.today.state === "late";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Pressable style={styles.avatar} onPress={onOpen}>
          <Text style={styles.avatarText}>{staff.initials}</Text>
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {staff.fullName}
          </Text>
          <Text style={styles.role} numberOfLines={1}>
            {staff.jobTitle}
          </Text>
        </View>

        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.badgeText, { color: tone.ink }]}>
            {staff.today.label}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.grid}>
        <Cell label={t("stf.tanggal")} value={date} />
        <Cell
          label={t("hm.clockIn")}
          value={staff.today.checkIn ?? "—"}
          color={isLate ? c.warn.ink : c.ink}
        />
        <Cell
          label={t("hm.clockOut")}
          value={staff.today.checkOut ?? t("stf.belum")}
          color={c.muted}
        />
      </View>
    </View>
  );
}

function Cell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tinta = color ?? c.ink;

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, { color: tinta }]} numberOfLines={1}>
        {value}
      </Text>
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

    tabRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    tab: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 14,
      alignItems: "center",
      backgroundColor: c.chip,
    },
    tabOn: { backgroundColor: c.accent },
    tabText: { fontSize: 12, fontWeight: "700", color: c.muted },
    tabTextOn: { color: "#fff" },

    chipRow: {
      paddingHorizontal: 18,
      gap: 7,
      alignItems: "center",
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

    card: {
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: 15,
      paddingVertical: 14,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 11 },
    cardDivider: {
      height: 1,
      backgroundColor: c.panelBorder,
      marginVertical: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 12.5, fontWeight: "700", color: c.info.ink },
    name: { fontSize: 13, fontWeight: "700", color: c.ink },
    role: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },
    badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: "700" },

    grid: { flexDirection: "row", gap: 8 },
    cellLabel: { fontSize: 10, fontWeight: "500", color: c.muted },
    cellValue: { fontSize: 11.5, fontWeight: "600", marginTop: 4 },

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
