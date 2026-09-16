import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/colors";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { ClockState } from "@/services/types";

export function ClockScreen({ navigation }: any) {
  const { employee } = useSession();
  const [state, setState] = useState<ClockState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getClockState(employee.id).then(setState);
  }, [employee]);

  if (!employee || !state) return null;

  const handlePress = async () => {
    setLoading(true);
    try {
      const next = state.clockedIn
        ? await hrisApi.clockOut(employee.id)
        : await hrisApi.clockIn(employee.id);
      setState(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.clockCard}>
        <Text style={styles.label}>Status hari ini</Text>
        <Text style={styles.status}>
          {state.clockedIn ? "Sedang bekerja" : "Belum absen masuk"}
        </Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.muted}>Masuk</Text>
            <Text style={styles.time}>{state.lastCheckIn ?? "—"}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.muted}>Keluar</Text>
            <Text style={styles.time}>{state.lastCheckOut ?? "—"}</Text>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            label={state.clockedIn ? "Clock Out" : "Clock In"}
            onPress={handlePress}
            loading={loading}
            variant={state.clockedIn ? "danger" : "primary"}
          />
        </View>
        <PrimaryButton
          label="Ajukan koreksi / Clock In / Clock Out"
          onPress={() => navigation.navigate("AttendanceCorrection")}
        />
        <Text style={styles.note}>
          Fase mocking: belum pakai GPS/face recognition — akan ditambah saat
          integrasi ERPNext.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  clockCard: { alignItems: "center", paddingVertical: 28 },
  label: { fontSize: 13, color: colors.muted },
  status: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 4,
    marginBottom: 20,
  },
  row: { flexDirection: "row", gap: 32 },
  col: { alignItems: "center" },
  muted: { fontSize: 12, color: colors.muted },
  time: { fontSize: 18, fontWeight: "600", color: colors.ink, marginTop: 2 },
  note: {
    marginTop: 18,
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
  },
});
