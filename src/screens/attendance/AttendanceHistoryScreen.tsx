import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, G } from "react-native-svg";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/theme/colors";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { AttendanceRecord, AttendanceStatus } from "@/services/types";
import {
  ATTENDANCE_STATUS_LABEL as STATUS_LABEL,
  ATTENDANCE_STATUS_TONE as STATUS_TONE,
} from "@/constants/statusLabels";
import { namaHari, tanggalAngka, bulanSingkat } from "@/utils/date";

const SIZE = 70;
const STROKE = 11;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

type Filter = "semua" | "telat" | "izin";

export function AttendanceHistoryScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filter, setFilter] = useState<Filter>("semua");

  useEffect(() => {
    if (!employee) return;
    hrisApi.getAttendanceHistory(employee.id).then(setRecords);
  }, [employee]);

  const count = (s: AttendanceStatus) =>
    records.filter((r) => r.status === s).length;

  const hadir = count("hadir");
  const telat = count("telat");
  const izin = count("izin");

  const persen = records.length
    ? `${(((hadir + telat) / records.length) * 100).toFixed(1).replace(".", ",")}%`
    : "–";

  const filtered = records.filter(
    (r) => filter === "semua" || r.status === filter,
  );

  const chips: { key: Filter; label: string }[] = [
    { key: "semua", label: "September" },
    { key: "telat", label: `Telat (${telat})` },
    { key: "izin", label: `Izin (${izin})` },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Riwayat Absensi</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.exportBtn}>
          <Text style={styles.exportText}>Export</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {chips.map((c) => {
          const on = filter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.recapCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recapLabel}>Rekap bulan ini</Text>
              <View style={styles.recapRow}>
                <Recap value={hadir} label="Hadir" color={colors.ink} />
                <Recap value={telat} label="Telat" color={colors.warn.ink} />
                <Recap value={izin} label="Izin" color={colors.info.ink} />
                <Recap value={0} label="Alpha" color={colors.bad.ink} />
              </View>
            </View>

            <Donut
              label={persen}
              segments={[
                { value: hadir, color: colors.accent },
                { value: telat, color: "#FBBF24" },
                { value: izin, color: colors.accentLight },
              ]}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.dateChip}>
              <Text style={styles.dateDay}>{tanggalAngka(item.date)}</Text>
              <Text style={styles.dateMonth}>{bulanSingkat(item.date)}</Text>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.dow}>{namaHari(item.date)}</Text>
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
  return (
    <View>
      <Text style={[styles.recapValue, { color }]}>{value}</Text>
      <Text style={styles.recapCaption}>{label}</Text>
    </View>
  );
}

function Donut({
  segments,
  label,
}: {
  segments: { value: number; color: string }[];
  label: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let walked = 0;

  return (
    <View style={styles.donut}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
          {segments.map((seg, i) => {
            const len = (seg.value / total) * CIRC;
            const offset = -walked;
            walked += len;
            return (
              <Circle
                key={i}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${CIRC - len}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </G>
      </Svg>

      <View style={styles.donutHole}>
        <Text style={styles.donutText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

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
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  exportBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
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
    backgroundColor: colors.chip,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: "600", color: "#475569" },
  chipTextOn: { color: "#fff" },

  list: { paddingHorizontal: 18, paddingBottom: 130 },

  recapCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 16,
    marginBottom: 14,
  },
  recapLabel: { fontSize: 11, fontWeight: "500", color: colors.muted },
  recapRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  recapValue: { fontSize: 20, lineHeight: 21, fontWeight: "800" },
  recapCaption: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 4,
  },

  donut: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  donutHole: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  donutText: { fontSize: 12, fontWeight: "800", color: colors.ink },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  dateChip: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDay: {
    fontSize: 14,
    lineHeight: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  dateMonth: {
    fontSize: 8,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
  },
  dow: { fontSize: 13, fontWeight: "600", color: colors.ink },
  detail: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 3,
  },
});
