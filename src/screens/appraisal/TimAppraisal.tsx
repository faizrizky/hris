import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { TeamAppraisal } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { desimal } from "@/utils/currency";
import { inisial } from "@/utils/ProfileCompleteness";
import { useT } from "@/i18n";

// Tab "Tim": karyawan yang bisa dinilai pemanggil (bawahan langsung, atau semua untuk HR).
export function TimAppraisal({
  navigation,
  atas,
}: {
  navigation: any;
  atas: React.ReactNode;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tim = useLoad(() => hrisApi.getTeamAppraisals(), "tim");
  const items = tim.data ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("ap2.judul")}</Text>
      </View>
      {atas}

      <ScrollView contentContainerStyle={styles.content}>
        {tim.error && !tim.data ? (
          <ErrorState pesan={tim.error} onUlangi={tim.ulangi} />
        ) : tim.memuat ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.row}>
                <Skeleton width={44} height={44} radius={22} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton width="58%" height={12} radius={4} />
                  <Skeleton width="40%" height={10} radius={4} />
                </View>
              </View>
            ))}
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t("ap2.timKosongJudul")}</Text>
            <Text style={styles.emptyText}>{t("ap2.timKosongIsi")}</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((a) => (
              <Baris
                key={a.employeeId}
                a={a}
                onPress={() =>
                  navigation.navigate("AppraisalFeedback", {
                    employeeId: a.employeeId,
                    employeeName: a.employeeName,
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Baris({ a, onPress }: { a: TeamAppraisal; onPress: () => void }) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tone =
    a.myStatus === "submitted"
      ? c.ok
      : a.myStatus === "draft"
        ? c.info
        : c.warn;
  const label =
    a.myStatus === "submitted"
      ? t("ap2.sudahDinilai", { skor: desimal(a.myScore ?? 0) })
      : a.myStatus === "draft"
        ? t("ap2.draft")
        : t("ap2.belumDinilai");
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{inisial(a.employeeName)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {a.employeeName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[a.designation, t("ap2.skorAkhir", { skor: desimal(a.finalScore) })]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
        <Text style={[styles.badgeText, { color: tone.ink }]}>{label}</Text>
      </View>
    </Pressable>
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
    content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 130 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 13.5, fontWeight: "700", color: c.info.ink },
    name: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    meta: { fontSize: 11, fontWeight: "500", color: c.muted, marginTop: 3 },
    badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: "700" },
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
