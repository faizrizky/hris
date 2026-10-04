import { useEffect, useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { AttendanceRecord, Staff } from "@/services/types";
import { Skeleton } from "@/components/Skeleton";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
} from "@/constants/statusLabels";
import { bulanSingkat, namaHari, tanggalAngka } from "@/utils/date";

export function StaffHistoryScreen({ navigation, route }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const { staffId } = route.params;

  const [staff, setStaff] = useState<Staff | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    let batal = false;

    Promise.all([
      hrisApi.getStaffDirectory(employee.id),
      hrisApi.getAttendanceHistory(staffId),
    ]).then(([dir, riwayat]) => {
      if (batal) return;
      setStaff(dir.items.find((s) => s.id === staffId) ?? null);
      setRecords(riwayat);
    });

    return () => {
      batal = true;
    };
  }, [employee, staffId]);

  const loading = records === null;
  const items = records ?? [];
  const hitung = (s: AttendanceRecord["status"]) =>
    items.filter((r) => r.status === s).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <Skeleton width={140} height={15} radius={5} />
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1}>
              {staff?.fullName ?? "Karyawan"}
            </Text>
          )}
          <Text style={styles.headerSub}>Riwayat absensi</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.recapCard}>
          <Recap
            value={loading ? "–" : hitung("hadir")}
            label="Hadir"
            tone={c.ok.ink}
          />
          <View style={styles.recapDivider} />
          <Recap
            value={loading ? "–" : hitung("telat")}
            label="Telat"
            tone={c.warn.ink}
          />
          <View style={styles.recapDivider} />
          <Recap
            value={loading ? "–" : hitung("izin")}
            label="Izin"
            tone={c.info.ink}
          />
        </View>

        <View style={{ gap: 10, marginTop: 12 }}>
          {loading
            ? [0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.row}>
                  <Skeleton width={40} height={40} radius={13} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <Skeleton width="45%" height={12} radius={4} />
                    <Skeleton width="70%" height={10} radius={4} />
                  </View>
                  <Skeleton width={48} height={20} radius={8} />
                </View>
              ))
            : items.map((r) => {
                const tone = c[ATTENDANCE_STATUS_TONE[r.status]];
                return (
                  <View key={r.id} style={styles.row}>
                    <View style={styles.dateChip}>
                      <Text style={styles.dateDay}>{tanggalAngka(r.date)}</Text>
                      <Text style={styles.dateMonth}>
                        {bulanSingkat(r.date)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.dow}>{namaHari(r.date)}</Text>
                      <Text style={styles.detail}>
                        {r.checkIn ?? "—"} — {r.checkOut ?? "—"} ·{" "}
                        {r.durationLabel ?? "—"}
                      </Text>
                    </View>

                    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.badgeText, { color: tone.ink }]}>
                        {ATTENDANCE_STATUS_LABEL[r.status]}
                      </Text>
                    </View>
                  </View>
                );
              })}
        </View>
      </ScrollView>
    </View>
  );
}

function Recap({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone: string;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[styles.recapValue, { color: tone }]}>{value}</Text>
      <Text style={styles.recapLabel}>{label}</Text>
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

    content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 130 },

    recapCard: {
      flexDirection: "row",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      borderRadius: 20,
      paddingVertical: 16,
    },
    recapDivider: { width: 1, backgroundColor: c.hair },
    recapValue: { fontSize: 20, lineHeight: 21, fontWeight: "800" },
    recapLabel: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 5,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: 15,
      paddingVertical: 14,
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
    badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: "700" },
  });
