import { useMemo } from "react";
import { usePagedList } from "@/hooks/usePagedList";
import { searchableText } from "@/utils/searchText";
import { ListSearchBar } from "@/components/ListSearchBar";
import { LoadMoreButton } from "@/components/LoadMoreButton";
import type { ScreenProps } from "@/navigation/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ErrorState } from "@/components/ErrorState";
import { NotifCategory } from "@/services/types";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";
import { useT } from "@/i18n";
import { EmptyState } from "@/components/EmptyState";
import { goBackOrHome } from "@/navigation/navigationBack";
import { useNotification } from "@/hooks/useNotification";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AnnouncementsList } from "@/screens/announcements/AnnouncementsScreen";

const CATEGORY_ICONS: Record<NotifCategory, keyof typeof Ionicons.glyphMap> = {
  Approval: "checkmark-done-outline",
  Payroll: "wallet-outline",
  Presensi: "finger-print-outline",
  Appraisal: "star-outline",
  Pengumuman: "megaphone-outline",
};

export function NotificationScreen({ navigation }: ScreenProps) {
  const {
    items,
    errorMessage,
    load,
    unreadCount,
    markRead,
    open,
    groups,
    activeTab,
    setActiveTab,
    announcementOpenId,
  } = useNotification({ navigation });
  const t = useT();
  const paged = usePagedList(items ?? [], searchableText);
  const visibleGroups = groups.filter((g) =>
    paged.visibleItems.some((n) => n.group === g),
  );
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Mengetuk notifikasi menandainya dibaca lalu membuka tempat yang dirujuk.
  // Nada "warn" dipakai server untuk "menunggu keputusanmu"; selain itu kabar
  // tentang pengajuan milik sendiri.
  // Judul seksi diturunkan dari datanya, bukan daftar tetap: urutan grup
  // mengikuti urutan kemunculan pertamanya di list.
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
        {activeTab === "inbox" ? (
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
        ) : null}
      </View>

      <SegmentedControl
        items={[
          { key: "inbox", label: t("nt.tabInbox") },
          { key: "announcements", label: t("nt.tabPengumuman") },
        ]}
        value={activeTab}
        onChange={setActiveTab}
        style={styles.tabs}
      />

      {activeTab === "announcements" ? (
        <AnnouncementsList
          key={announcementOpenId ?? "none"}
          initialOpenId={announcementOpenId}
        />
      ) : (
        <>
          {items !== null && items.length > 0 ? (
            <ListSearchBar
              inset
              value={paged.query}
              onChangeText={paged.changeQuery}
            />
          ) : null}
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
              visibleGroups.map((g, groupIndex) => (
                <View
                  key={g}
                  style={groupIndex > 0 ? styles.groupGap : undefined}
                >
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
            {items !== null && items.length > 0 && paged.matchedCount === 0 ? (
              <Text style={styles.noResult}>{t("list.tanpaHasil")}</Text>
            ) : null}
            {paged.hasMore ? (
              <LoadMoreButton
                remainingCount={paged.remainingCount}
                onPress={paged.loadMore}
              />
            ) : null}
          </ScrollView>
        </>
      )}
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
    tabs: { marginHorizontal: 18, marginBottom: 12 },

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

    content: { paddingHorizontal: 18, paddingBottom: 170 },

    groupGap: { marginTop: 16 },
    noResult: {
      textAlign: "center",
      fontSize: 12.5,
      fontWeight: "500",
      color: c.muted,
      paddingVertical: 28,
    },
    groupLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: c.muted,
      marginHorizontal: 2,
      marginBottom: 9,
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
