import { useCallback, useState, useMemo } from "react";
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
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";
import { useT } from "@/i18n";
import { bukaLampiran } from "@/utils/lampiran";
import { useConfirm } from "@/components/ConfirmDialog";

const ICON_KATEGORI: Record<NotifCategory, string> = {
  Approval: ICON.approval,
  Payroll: ICON.payslip,
  Presensi: ICON.clock,
  Appraisal: ICON.appraisal,
  Pengumuman: ICON.bell,
};

export function NotificationScreen({ navigation }: any) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(() => {
    if (!employee) return;
    setGalat(null);
    hrisApi
      .getNotificationInbox(employee.id)
      .then(setItems)
      .catch((e) => setGalat(describeError(e)));
  }, [employee]);

  useFocusEffect(muat);

  const belumDibaca = items === null ? 0 : items.filter((n) => !n.read).length;

  const tandai = (ids?: string[]) => {
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
  const buka = async (n: AppNotification) => {
    if (!n.read) tandai([n.id]);
    const atasan = employee?.role === "mss" || employee?.role === "hr";
    const menunggu = n.tone === "warn" && atasan;
    switch (n.documentType) {
      case "Employee Document":
        if (n.fileUrl && employee?.role === "hr") {
          try {
            await bukaLampiran(n.fileUrl, n.documentName ?? "dokumen");
          } catch {
            void confirm({
              title: t("lamp.gagalJudul"),
              message: t("lamp.gagalPesan"),
              tone: "warn",
              confirmText: t("umum.mengerti"),
              cancelText: null,
            });
          }
          return;
        }
        if (employee?.role !== "hr") {
          navigation.navigate("Profil", { screen: "ProfileDocs" });
        }
        return;
      case "Leave Application":
      case "Overtime Request":
      case "Travel Request":
      case "Attendance Request":
        if (menunggu) {
          navigation.navigate("Approval");
          return;
        }
        if (n.documentType === "Attendance Request") {
          navigation.navigate("Absensi", {
            screen: "AttendanceCorrectionHistory",
          });
        } else if (n.documentType === "Overtime Request") {
          navigation.navigate("Cuti", { screen: "Overtime" });
        } else {
          navigation.navigate("Cuti", { screen: "LeaveList" });
        }
        return;
    }
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
        <Text style={styles.headerTitle}>{t("nt.judul")}</Text>
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
            {t("nt.tandai")}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {galat && items === null ? (
          <ErrorState pesan={galat} onUlangi={muat} />
        ) : items === null ? (
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
            <Text style={styles.emptyTitle}>{t("nt.kosongJudul")}</Text>
            <Text style={styles.emptyText}>{t("nt.kosongIsi")}</Text>
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
                        onPress={() => buka(n)}
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
