import { useCallback, useEffect, useState, useMemo } from "react";
import type { ScreenProps } from "@/navigation/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { ErrorState } from "@/components/ErrorState";
import { useSession } from "@/services/session";
import { AppNotification, NotifCategory } from "@/services/types";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";
import { useT } from "@/i18n";
import { EmptyState } from "@/components/EmptyState";
import { setUnreadCount } from "@/navigation/notifBadge";
import { goBackOrHome } from "@/navigation/kembali";

const CATEGORY_ICONS: Record<NotifCategory, keyof typeof Ionicons.glyphMap> = {
  Approval: "checkmark-done-outline",
  Payroll: "wallet-outline",
  Presensi: "finger-print-outline",
  Appraisal: "star-outline",
  Pengumuman: "megaphone-outline",
};

export function NotificationScreen({ navigation }: ScreenProps) {
  const t = useT();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    hrisApi
      .getNotificationInbox(employee.id)
      .then(setItems)
      .catch((e) => setErrorMessage(describeError(e)));
  }, [employee]);

  useFocusEffect(load);

  const unreadCount = items === null ? 0 : items.filter((n) => !n.read).length;

  useEffect(() => {
    if (items !== null) setUnreadCount(unreadCount);
  }, [items, unreadCount]);

  const markRead = (ids?: string[]) => {
    if (!employee) return;
    hrisApi
      .markNotificationsRead(employee.id, ids)
      .then(setItems)
      // Gagal menandai dibaca tidak kritis; daftar tetap seperti semula.
      .catch(() => {});
  };

  // Mengetuk notifikasi menandainya dibaca lalu membuka tempat yang dirujuk.
  // Nada "warn" dipakai server untuk "menunggu keputusanmu"; selain itu kabar
  // tentang pengajuan milik sendiri.
  const open = async (n: AppNotification) => {
    if (!n.read) markRead([n.id]);
    const isSupervisor = employee?.role === "mss" || employee?.role === "hr";
    const isPending = n.tone === "warn" && isSupervisor;
    switch (n.documentType) {
      case "Employee Document":
        // HR meninjau di layar verifikasi; karyawan melihat daftar dokumennya.
        if (employee?.role === "hr" && n.tone === "warn") {
          // Buka tab sesuai konteks: permintaan ubah dokumen -> "Perubahan", lainnya -> "Menunggu".
          navigation.navigate("DocumentReview", {
            status:
              n.documentStatus === "Change Requested"
                ? "Change Requested"
                : "Pending",
          });
        } else {
          navigation.navigate("Profil", { screen: "ProfileDocs" });
        }
        return;
      case "Employee Checkin":
        if (isPending) navigation.navigate("OfflineReview");
        return;
      case "Face Enrollment":
        // HR meninjau di web; karyawan membuka layar pendaftaran wajahnya.
        if (employee?.role !== "hr") {
          navigation.navigate("Profil", { screen: "FaceEnroll" });
        }
        return;
      case "HR Announcement":
        navigation.navigate("Announcements", { id: n.documentName });
        return;
      case "Profile Change Request":
        if (employee?.role === "hr" && n.tone === "warn") {
          navigation.navigate("ProfileChangeReview");
        } else {
          navigation.navigate("Profil", { screen: "ProfileData" });
        }
        return;
      case "Leave Application":
      case "Overtime Request":
      case "Travel Request":
      case "WFH Schedule":
      case "Attendance Request":
        if (isPending) {
          navigation.navigate("Approval");
          return;
        }
        if (n.documentType === "Attendance Request") {
          navigation.navigate("AttendanceCorrectionHistory");
        } else if (n.documentType === "Overtime Request") {
          navigation.navigate("Overtime");
        } else {
          navigation.navigate("LeaveList");
        }
        return;
    }
  };

  // Judul seksi diturunkan dari datanya, bukan daftar tetap: urutan grup
  // mengikuti urutan kemunculan pertamanya di list.
  const groups: string[] = [];
  for (const n of items ?? [])
    if (!groups.includes(n.group)) groups.push(n.group);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackOrHome(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("nt.judul")}</Text>
        <Pressable
          onPress={() => markRead()}
          disabled={unreadCount === 0}
          hitSlop={8}
        >
          <Text
            style={[
              styles.markAll,
              unreadCount === 0 && { color: c.mutedLabel },
            ]}
          >
            {t("nt.tandai")}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {errorMessage && items === null ? (
          <ErrorState message={errorMessage} onRetry={load} />
        ) : items === null ? (
          <View style={{ gap: 9 }}>
            {[0, 1, 2, 3].map((i) => (
              <NotificationCardSkeleton key={i} />
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ICON.bell}
            title={t("nt.kosongJudul")}
            text={t("nt.kosongIsi")}
          />
        ) : (
          groups.map((g) => (
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
                        onPress={() => open(n)}
                        style={[
                          styles.card,
                          !n.read && { backgroundColor: c.unread },
                        ]}
                      >
                        <View
                          style={[
                            styles.icon,
                            { backgroundColor: "transparent" },
                          ]}
                        >
                          <Ionicons
                            name={CATEGORY_ICONS[n.category]}
                            color={tone.ink}
                            size={26}
                          />
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.title}>{n.title}</Text>
                          <Text style={styles.body}>{n.body}</Text>
                          <Text style={styles.time}>
                            {n.timeLabel} · {t(`cat.${n.category}`)}
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

function NotificationCardSkeleton() {
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

    content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 170 },

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
