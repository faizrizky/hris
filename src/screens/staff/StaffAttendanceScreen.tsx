import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SemanticTone, Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { Staff, StaffAttendanceState, StaffDirectory } from "@/services/types";
import { Skeleton } from "@/components/Skeleton";
import {
  formatTanggalPanjang,
  tanggalPendekTahun,
  toISODate,
} from "@/utils/date";

const SEMUA = "Semua";

const TABS: { key: StaffAttendanceState; label: string }[] = [
  { key: "attend", label: "Hadir" },
  { key: "late", label: "Telat" },
  { key: "leave", label: "Cuti" },
];

const TONE: Record<StaffAttendanceState, SemanticTone> = {
  attend: "ok",
  late: "warn",
  leave: "info",
};

export function StaffAttendanceScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();

  const [dir, setDir] = useState<StaffDirectory | null>(null);
  const [tab, setTab] = useState<StaffAttendanceState>("attend");
  const [dept, setDept] = useState(SEMUA);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getStaffDirectory(employee.id).then(setDir);
  }, [employee]);

  const items = dir?.items ?? [];
  const loading = dir === null;
  const hariIni = tanggalPendekTahun(toISODate(new Date()));

  const chips = useMemo(() => {
    const nama: string[] = [];
    for (const s of items)
      if (!nama.includes(s.department)) nama.push(s.department);
    return [SEMUA, ...nama];
  }, [items]);

  const seDept = items.filter((s) => dept === SEMUA || s.department === dept);
  const hitungTab = (k: StaffAttendanceState) =>
    seDept.filter((s) => s.today.state === k).length;

  const tersaring = seDept.filter((s) => s.today.state === tab);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>Absensi Karyawan</Text>
          <Text style={styles.headerSub}>{formatTanggalPanjang()}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>
                {t.label} · {loading ? "–" : hitungTab(t.key)}
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
        {loading
          ? [92, 110, 74].map((w, i) => (
              <Skeleton key={i} width={w} height={31} radius={999} />
            ))
          : chips.map((c) => {
              const on = dept === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setDept(c)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list}>
        {loading ? (
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
        ) : tersaring.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Tidak ada di kategori ini</Text>
            <Text style={styles.emptyText}>
              Belum ada karyawan berstatus{" "}
              {TABS.find((t) => t.key === tab)?.label.toLowerCase()} hari ini
              {dept === SEMUA ? "" : ` di ${dept}`}.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {tersaring.map((s) => (
              <AttendanceCard
                key={s.id}
                staff={s}
                tanggal={hariIni}
                onOpen={() =>
                  navigation.navigate("StaffDetail", { staffId: s.id })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AttendanceCard({
  staff,
  tanggal,
  onOpen,
}: {
  staff: Staff;
  tanggal: string;
  onOpen: () => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const tone = c[TONE[staff.today.state]];
  const telat = staff.today.state === "late";

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
        <Cell label="Tanggal" value={tanggal} />
        <Cell
          label="Clock In"
          value={staff.today.checkIn ?? "—"}
          color={telat ? c.warn.ink : c.ink}
        />
        <Cell
          label="Clock Out"
          value={staff.today.checkOut ?? "Belum"}
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

    list: { paddingHorizontal: 18, paddingBottom: 130 },

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
