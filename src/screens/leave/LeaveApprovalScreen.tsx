import React, { useCallback, useState, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBadge } from "@/components/StatusBadge";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE } from "@/constants/statusLabels";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveRequest } from "@/services/types";

// Layar ini cuma di-mount untuk role mss/hr (lihat RootNavigator).
export function LeaveApprovalScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const load = useCallback(() => {
    if (!employee) return;
    hrisApi.getPendingApprovals(employee.id).then(setItems);
  }, [employee]);

  useFocusEffect(load);

  // Simpan hasilnya ke state supaya banner "Disetujui/Ditolak" langsung muncul
  // di kartunya, bukan kartunya hilang begitu saja.
  const decide = async (id: string, decision: "approve" | "reject") => {
    const updated = await hrisApi.decideLeaveRequest(id, decision);
    setItems((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  const approveAll = async () => {
    setBusy(true);
    try {
      for (const item of items.filter((r) => r.decision === null)) {
        await decide(item.id, "approve");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!employee) return null;

  const pending = items.filter((r) => r.decision === null).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.navigate("Beranda")}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>Inbox Approval</Text>
          <Text style={styles.headerSub}>
            {pending > 0
              ? `${pending} menunggu persetujuan`
              : "Semua sudah diproses"}
          </Text>
        </View>

        {pending > 0 && (
          <Pressable
            style={styles.approveAll}
            onPress={approveAll}
            disabled={busy}
          >
            <Text style={styles.approveAllText}>
              {busy ? "Memproses..." : "Setujui semua"}
            </Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <Text style={styles.empty}>Tidak ada approval yang menunggu.</Text>
        }
        renderItem={({ item }) => {
          const tone = LEAVE_TYPE_TONE[item.type];
          return (
            <View style={styles.card}>
              <View style={styles.topRow}>
                <View style={[styles.avatar, { backgroundColor: c[tone].bg }]}>
                  <Text style={[styles.avatarText, { color: c[tone].ink }]}>
                    {item.employeeInitials}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{item.employeeName}</Text>
                  <Text style={styles.jobTitle}>{item.employeeJobTitle}</Text>
                </View>

                <StatusBadge
                  label={LEAVE_TYPE_LABEL[item.type]}
                  tone={tone}
                  variant="compact"
                />
              </View>

              <View style={styles.detailBox}>
                <Text style={styles.detail}>{item.label}</Text>
                <Text style={styles.reason}>{item.reason}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.stage}>{item.stage}</Text>
                  <Text style={styles.quota}>· sisa kuota {item.quota}</Text>
                </View>
              </View>

              {item.decision === null ? (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.rejectBtn}
                    onPress={() => decide(item.id, "reject")}
                  >
                    <Text style={styles.rejectText}>Tolak</Text>
                  </Pressable>
                  <Pressable
                    style={styles.approveBtn}
                    onPress={() => decide(item.id, "approve")}
                  >
                    <Text style={styles.approveText}>Setujui</Text>
                  </Pressable>
                </View>
              ) : (
                <View
                  style={[
                    styles.result,
                    {
                      backgroundColor:
                        item.decision === "approve" ? c.ok.bg : c.bad.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.resultText,
                      {
                        color:
                          item.decision === "approve" ? c.ok.ink : c.bad.ink,
                      },
                    ]}
                  >
                    {item.decision === "approve"
                      ? "Sudah disetujui"
                      : "Sudah ditolak"}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />
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
    approveAll: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: c.accent,
    },
    approveAllText: { fontSize: 11.5, fontWeight: "600", color: "#fff" },

    content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 130 },
    empty: { fontSize: 13, color: c.muted, marginHorizontal: 2 },

    card: {
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: 15,
      marginBottom: 11,
    },
    topRow: { flexDirection: "row", alignItems: "center", gap: 11 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 12.5, fontWeight: "700" },
    name: { fontSize: 13.5, fontWeight: "600", color: c.ink },
    jobTitle: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    detailBox: {
      marginTop: 12,
      borderRadius: 14,
      backgroundColor: c.chip,
      paddingHorizontal: 13,
      paddingVertical: 12,
    },
    detail: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    reason: {
      fontSize: 11,
      lineHeight: 16.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 5,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginTop: 9,
    },
    stage: { fontSize: 10, fontWeight: "600", color: c.info.ink },
    quota: { fontSize: 10, fontWeight: "500", color: c.mutedLabel },

    actions: { flexDirection: "row", gap: 9, marginTop: 12 },
    rejectBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: c.bad.bg,
      alignItems: "center",
    },
    rejectText: { fontSize: 12.5, fontWeight: "700", color: c.bad.ink },
    approveBtn: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: c.accent,
      alignItems: "center",
    },
    approveText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },

    result: {
      marginTop: 12,
      paddingVertical: 11,
      borderRadius: 13,
      alignItems: "center",
    },
    resultText: { fontSize: 12, fontWeight: "700" },
  });
