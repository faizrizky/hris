import React, { useCallback, useState, useMemo, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealFlatList as FlatList } from "@/components/Reveal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Skeleton";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { LEAVE_TYPE_LABEL, LEAVE_TYPE_TONE } from "@/constants/statusLabels";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveRequest } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { describeError } from "@/services/api/http";
import { ErrorState } from "@/components/ErrorState";
import { useT } from "@/i18n";
import { LampiranList } from "./LampiranList";
import { EmptyState } from "@/components/EmptyState";
import { ICON } from "@/constants/icons";

// Layar ini cuma di-mount untuk role mss/hr (lihat RootNavigator).
export function LeaveApprovalScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LeaveRequest[] | null>(null);
  const [busy, setBusy] = useState(false);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();
  // Dialog konfirmasi tumbuh dari tombol ini, seperti dialog Keluar.
  const pemicu = useRef<View>(null);
  const t = useT();
  const [galat, setGalat] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!employee) return;
    setGalat(null);
    hrisApi
      .getPendingApprovals(employee.id)
      .then(setItems)
      .catch((e) => setGalat(describeError(e)));
  }, [employee]);

  // Dimuat ulang tiap layar mendapat fokus, supaya pengajuan baru langsung masuk.
  useFocusEffect(load);

  const decide = async (id: string, decision: "approve" | "reject") => {
    try {
      const updated = await hrisApi.decideLeaveRequest(id, decision);
      setItems((prev) => (prev ?? []).map((r) => (r.id === id ? updated : r)));
      return true;
    } catch (e) {
      void confirm({
        title: t("umum.gagalMemproses"),
        message: describeError(e),
        tone: "bad",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      return false;
    }
  };

  const approveAll = async () => {
    const antre = (items ?? []).filter((r) => r.decision === null);
    const ya = await confirm({
      title: t("ap.setujuiN", { n: antre.length }),
      message: t("ap.setujuiPesan"),
      tone: "warn",
      confirmText: t("ap.setujuiSemua"),
      cancelText: t("umum.batal"),
      from: pemicu,
      fromColor: c.accent,
      fromTextColor: "#FFFFFF",
      fromLabel: t("ap.setujuiSemua"),
      fromRadius: 999,
    });
    if (!ya) return;
    setBusy(true);
    try {
      for (const item of antre) {
        if (!(await decide(item.id, "approve"))) break; // berhenti di galat pertama
      }
    } finally {
      setBusy(false);
    }
  };

  if (!employee) return null;

  const memuat = items === null;
  const pending = (items ?? []).filter((r) => r.decision === null).length;

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
          <Text style={styles.headerTitle}>{t("ap.judul")}</Text>
          <Text style={styles.headerSub}>
            {memuat
              ? t("umum.memuat")
              : pending > 0
                ? t("ap.menunggu", { n: pending })
                : t("ap.semuaDiproses")}
          </Text>
        </View>

        {pending > 0 && (
          <Pressable
            ref={pemicu}
            style={styles.approveAll}
            onPress={approveAll}
            disabled={busy}
          >
            <Text style={styles.approveAllText}>
              {busy ? t("umum.memproses") : t("ap.setujuiSemua")}
            </Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          galat && items === null ? (
            <ErrorState pesan={galat} onUlangi={load} />
          ) : memuat ? (
            <ApprovalCardSkeleton />
          ) : (
            <EmptyState icon={ICON.approval} title={t("ap.kosong")} />
          )
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
                <LampiranList items={item.attachments} />
                <View style={styles.metaRow}>
                  <Text style={styles.stage}>{item.stage}</Text>
                  <Text style={styles.quota}>
                    {t("ap.sisaKuota", { q: item.quota })}
                  </Text>
                </View>
              </View>

              {item.decision === null ? (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.rejectBtn}
                    onPress={() => decide(item.id, "reject")}
                  >
                    <Text style={styles.rejectText}>{t("ap.tolak")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.approveBtn}
                    onPress={() => decide(item.id, "approve")}
                  >
                    <Text style={styles.approveText}>{t("ap.setujui")}</Text>
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
                      ? t("ap.sudahDisetujui")
                      : t("ap.sudahDitolak")}
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
function ApprovalCardSkeleton() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <>
      {[0, 1].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.topRow}>
            <Skeleton width={40} height={40} radius={14} />
            <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
              <Skeleton width="54%" height={12} radius={4} />
              <Skeleton width="38%" height={10} radius={4} />
            </View>
            <Skeleton width={58} height={20} radius={8} />
          </View>

          <View style={[styles.detailBox, { gap: 8 }]}>
            <Skeleton width="62%" height={11} radius={4} />
            <Skeleton width="90%" height={10} radius={4} />
            <Skeleton width="44%" height={9} radius={4} />
          </View>

          <View style={styles.actions}>
            <Skeleton style={{ flex: 1 }} height={41} radius={13} />
            <Skeleton style={{ flex: 2 }} height={41} radius={13} />
          </View>
        </View>
      ))}
    </>
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
