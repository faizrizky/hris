import { useCallback, useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { AppNotification, NotifCategory } from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";

const ICON_KATEGORI: Record<NotifCategory, string> = {
  Approval: ICON.approval,
  Payroll: ICON.payslip,
  Presensi: ICON.clock,
  Appraisal: ICON.appraisal,
  Pengumuman: ICON.bell,
};

export function NotificationScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const muat = useCallback(() => {
    if (!employee) return;
    hrisApi.getNotificationInbox(employee.id).then(setItems);
  }, [employee]);

  useFocusEffect(muat);

  const belumDibaca = items === null ? 0 : items.filter((n) => !n.read).length;

  const tandai = (ids?: string[]) => {
    if (!employee) return;
    hrisApi.markNotificationsRead(employee.id, ids).then(setItems);
  };

  // Judul seksi diturunkan dari datanya, bukan daftar tetap: urutan grup
  // mengikuti urutan kemunculan pertamanya di list.
  const grup: string[] = [];
  for (const n of items ?? []) if (!grup.includes(n.group)) grup.push(n.group);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifikasi</Text>
        <Pressable
          onPress={() => tandai()}
          disabled={belumDibaca === 0}
          hitSlop={8}
        >
          <Text
            style={[
              styles.markAll,
              belumDibaca === 0 && { color: c.mutedLabel },
            ]}
          >
            Tandai dibaca
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {items === null ? (
          <View style={{ gap: 9 }}>
            {[0, 1, 2, 3].map((i) => (
              <NotifCardSkeleton key={i} />
            ))}
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <LineIcon d={ICON.bell} color={c.muted} size={22} />
            </View>
            <Text style={styles.emptyTitle}>Tidak ada notifikasi</Text>
            <Text style={styles.emptyText}>
              Kabar approval, payroll, dan pengingat presensi akan muncul di
              sini.
            </Text>
          </View>
        ) : (
          grup.map((g) => (
            <View key={g}>
              <Text style={styles.groupLabel}>{g}</Text>
              <View style={{ gap: 9 }}>
                {items
                  .filter((n) => n.group === g)
                  .map((n) => {
                    const tone = c[n.tone];
                    return (
                      <Pressable
                        key={n.id}
                        onPress={() => !n.read && tandai([n.id])}
                        style={[
                          styles.card,
                          !n.read && { backgroundColor: c.unread },
                        ]}
                      >
                        <View
                          style={[styles.icon, { backgroundColor: tone.bg }]}
                        >
                          <LineIcon
                            d={ICON_KATEGORI[n.category]}
                            color={tone.ink}
                            size={17}
                          />
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.title}>{n.title}</Text>
                          <Text style={styles.body}>{n.body}</Text>
                          <Text style={styles.time}>
                            {n.timeLabel} · {n.category}
                          </Text>
                        </View>

                        {!n.read && <View style={styles.dot} />}
                      </Pressable>
                    );
                  })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function NotifCardSkeleton() {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.card}>
      <Skeleton width={36} height={36} radius={12} />
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
        <Skeleton width="72%" height={12} radius={4} />
        <Skeleton width="94%" height={10} radius={4} />
        <Skeleton width="42%" height={9} radius={4} />
      </View>
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
    headerTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: c.ink,
    },
    markAll: { fontSize: 11.5, fontWeight: "600", color: c.accent },

    content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 130 },

    groupLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: c.muted,
      marginHorizontal: 2,
      marginBottom: 9,
      marginTop: 14,
    },

    card: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 14,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      color: c.ink,
    },
    body: {
      fontSize: 11.5,
      lineHeight: 17,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },
    time: {
      fontSize: 10,
      fontWeight: "500",
      color: c.mutedLabel,
      marginTop: 7,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.accent,
      marginTop: 4,
    },

    emptyCard: {
      alignItems: "center",
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingVertical: 32,
      paddingHorizontal: 24,
      marginTop: 8,
    },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 13.5,
      fontWeight: "700",
      color: c.ink,
      marginTop: 14,
    },
    emptyText: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.muted,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 6,
    },
  });
