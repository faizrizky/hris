import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/theme/colors";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { NotificationItem } from "@/services/types";

export function HomeScreen() {
  const { employee } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getNotifications(employee.id).then(setNotifications);
  }, [employee]);

  if (!employee) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>
        Halo, {employee.fullName.split(" ")[0]}
      </Text>
      <Text style={styles.role}>
        {employee.jobTitle} · {employee.department}
      </Text>

      <Card>
        <Text style={styles.cardTitle}>Aktivitas terbaru</Text>
        {notifications.length === 0 && (
          <Text style={styles.muted}>Belum ada notifikasi.</Text>
        )}
        {notifications.map((n) => (
          <View key={n.id} style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Text style={styles.notifSub}>{n.subtitle}</Text>
            </View>
            <StatusBadge
              label={
                n.tone === "ok"
                  ? "Selesai"
                  : n.tone === "warn"
                    ? "Pending"
                    : "Info"
              }
              tone={n.tone}
            />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 4 },
  greeting: { fontSize: 17, fontWeight: "600", color: colors.ink },
  role: { fontSize: 13, color: colors.muted, marginBottom: 20, marginTop: 2 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 12,
  },
  muted: { color: colors.muted, fontSize: 13 },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.hair,
    gap: 12,
  },
  notifTitle: { fontSize: 14, fontWeight: "600", color: colors.ink },
  notifSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
