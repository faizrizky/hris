import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBadge } from "@/components/StatusBadge";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { leaveDecisionBadge } from "@/constants/statusLabels";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveBalance, LeaveRequest } from "@/services/types";

export function LeaveListScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const load = useCallback(() => {
    if (!employee) return;
    hrisApi.getLeaveBalances(employee.id).then(setBalances);
    hrisApi.getLeaveRequests(employee.id).then(setRequests);
  }, [employee]);

  useEffect(load, [load]);
  useFocusEffect(load);

  if (!employee) return null;

  const cuti = balances.find((b) => b.type === "cuti");
  const sakit = balances.find((b) => b.type === "sakit");
  const terpakai = cuti ? cuti.total - cuti.remaining : 0;
  const sisaPersen =
    cuti && cuti.total ? (cuti.remaining / cuti.total) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.getParent()?.navigate("Beranda")}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Cuti &amp; Izin</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.heroShadow}>
              <LinearGradient
                colors={[c.accent, c.accent2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroBlob} />

                <Text style={styles.heroLabel}>Saldo cuti tahunan 2026</Text>

                <View style={styles.balanceRow}>
                  <Text style={styles.balanceBig}>
                    {cuti?.remaining ?? "–"}
                  </Text>
                  <Text style={styles.balanceTotal}>
                    / {cuti?.total ?? "–"} {cuti?.unit ?? "hari"}
                  </Text>
                </View>

                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${sisaPersen}%` }]} />
                </View>

                <View style={styles.heroBoxes}>
                  <View style={styles.heroBox}>
                    <Text style={styles.heroBoxLabel}>Terpakai</Text>
                    <Text style={styles.heroBoxValue}>
                      {terpakai} {cuti?.unit ?? "hari"}
                    </Text>
                  </View>
                  <View style={styles.heroBox}>
                    <Text style={styles.heroBoxLabel}>Sisa cuti sakit</Text>
                    <Text style={styles.heroBoxValue}>
                      {sakit ? `${sakit.remaining} ${sakit.unit}` : "–"}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.actionGrid}>
              <Pressable
                style={styles.actionCard}
                onPress={() =>
                  navigation.navigate("LeaveRequest", { kind: "dinas" })
                }
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: c.info.bg }]}
                >
                  <LineIcon d={ICON.plus} color={c.info.ink} size={16} />
                </View>
                <Text style={styles.actionTitle}>Ajukan cuti</Text>
                <Text style={styles.actionSub}>Tahunan, sakit, melahirkan</Text>
              </Pressable>

              <Pressable
                style={styles.actionCard}
                onPress={() =>
                  navigation.navigate("LeaveRequest", { kind: "cuti" })
                }
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: c.purple.bg }]}
                >
                  <LineIcon d={ICON.location} color={c.purple.ink} size={16} />
                </View>
                <Text style={styles.actionTitle}>Dinas luar</Text>
                <Text style={styles.actionSub}>
                  Perjalanan kerja / kunjungan
                </Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Pengajuan saya</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Belum ada pengajuan.</Text>
        }
        renderItem={({ item }) => {
          const badge = leaveDecisionBadge(item.decision);
          return (
            <View style={styles.reqCard}>
              <View style={styles.reqTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.reqType}>{item.label}</Text>
                  <Text style={styles.reqMeta}>{item.reason}</Text>
                </View>
                <StatusBadge
                  label={badge.label}
                  tone={badge.tone}
                  variant="compact"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.approverRow}>
                <View style={styles.approverAvatar}>
                  <Text style={styles.approverInitials}>
                    {item.approverInitials}
                  </Text>
                </View>
                <Text style={styles.approverName}>
                  Approver: {item.approverName}
                </Text>
                <Text style={styles.stage}>{item.stage}</Text>
              </View>
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

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

    heroShadow: {
      borderRadius: 22,
      shadowColor: c.accent2,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.26,
      shadowRadius: 26,
      elevation: 6,
    },
    heroCard: { borderRadius: 22, padding: 18, overflow: "hidden" },
    heroBlob: {
      position: "absolute",
      right: -40,
      top: -40,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: "rgba(255,255,255,0.09)",
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: "rgba(255,255,255,0.85)",
    },
    balanceRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      marginTop: 8,
    },
    balanceBig: {
      fontSize: 44,
      lineHeight: 46,
      fontWeight: "800",
      letterSpacing: -1.8,
      color: "#fff",
    },
    balanceTotal: {
      fontSize: 14,
      fontWeight: "600",
      color: "rgba(255,255,255,0.8)",
      paddingBottom: 5,
    },
    bar: {
      height: 7,
      borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.22)",
      marginTop: 14,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 4, backgroundColor: "#fff" },
    heroBoxes: { flexDirection: "row", gap: 10, marginTop: 14 },
    heroBox: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 13,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    heroBoxLabel: {
      fontSize: 10.5,
      fontWeight: "500",
      color: "rgba(255,255,255,0.8)",
    },
    heroBoxValue: {
      fontSize: 15,
      fontWeight: "700",
      color: "#fff",
      marginTop: 3,
    },

    actionGrid: { flexDirection: "row", gap: 10, marginTop: 12 },
    actionCard: {
      flex: 1,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 14,
    },
    actionIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    actionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.ink,
      marginTop: 10,
    },
    actionSub: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.ink,
      marginTop: 20,
      marginBottom: 10,
      marginHorizontal: 2,
    },
    empty: { fontSize: 13, color: c.muted, marginHorizontal: 2 },

    reqCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 15,
      marginBottom: 10,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    reqTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    reqType: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    reqMeta: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },
    divider: { height: 1, backgroundColor: c.hair, marginVertical: 12 },
    approverRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    approverAvatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    approverInitials: { fontSize: 9, fontWeight: "700", color: c.info.ink },
    approverName: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      flex: 1,
    },
    stage: { fontSize: 10.5, fontWeight: "600", color: c.accent },
  });
