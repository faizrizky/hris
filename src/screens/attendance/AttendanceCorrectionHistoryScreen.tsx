import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/theme/colors";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import {
  AttendanceCorrectionRequest,
  AttendanceRequestedStatus,
} from "@/services/types";

import {
  CORRECTION_STATUS_LABEL as STATUS_LABEL,
  CORRECTION_STATUS_TONE as STATUS_TONE,
} from "@/constants/statusLabels";

export function AttendanceCorrectionHistoryScreen() {
  const { employee } = useSession();
  const [records, setRecords] = useState<AttendanceCorrectionRequest[]>([]);
  const [filter, setFilter] = useState<"semua" | AttendanceRequestedStatus>(
    "semua",
  );

  useEffect(() => {
    if (!employee) return;
    hrisApi.getAttendanceCorrections(employee.id).then(setRecords);
  }, [employee]);

  const filtered = records.filter(
    (r) => filter === "semua" || r.status === filter,
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {(["semua", "pending", "approved", "rejected"] as const).map((f) => (
          <Text
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            {f === "semua" ? "Semua" : STATUS_LABEL[f]}
          </Text>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 8 }}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={styles.muted}>
                {item.requestedCheckIn ?? "—"} - {item.requestedCheckOut ?? "—"}{" "}
                · {item.reason ?? "—"}
              </Text>
            </View>
            <StatusBadge
              label={STATUS_LABEL[item.status]}
              tone={STATUS_TONE[item.status]}
            />
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filterChip: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  filterChipActive: { backgroundColor: colors.accent, color: "#fff" },
  row: { flexDirection: "row", alignItems: "center" },
  date: { fontSize: 14, fontWeight: "600", color: colors.ink },
  muted: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
