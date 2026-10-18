import React, { useMemo, useState } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { Announcement } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { ICON } from "@/constants/icons";
import { goBackAnimated } from "@/navigation/navigationBack";
import { formatShortDateWithYear } from "@/utils/date";
import { AttachmentList } from "@/screens/leave/AttachmentList";
import { useT } from "@/i18n";

// Pengumuman dari HR (doctype HR Announcement di ERPNext).
export function AnnouncementsScreen({ navigation, route }: ScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const announcementList = useLoad(
    () => hrisApi.getAnnouncements(),
    "pengumuman",
  );
  const [openId, setOpenId] = useState<string | null>(
    getRouteParams<{ id?: string }>(route).id ?? null,
  );
  const items = announcementList.data ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackAnimated(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>{t("an.judul")}</Text>
          <Text style={styles.headerSub}>{t("an.sub")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {announcementList.error && !announcementList.data ? (
          <ErrorState
            message={announcementList.error}
            onRetry={announcementList.retry}
          />
        ) : announcementList.isLoading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.card}>
                <Skeleton width="60%" height={13} radius={4} />
                <Skeleton
                  width="90%"
                  height={10}
                  radius={4}
                  style={{ marginTop: 10 }}
                />
                <Skeleton
                  width="70%"
                  height={10}
                  radius={4}
                  style={{ marginTop: 6 }}
                />
              </View>
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ICON.bell}
            title={t("an.kosongJudul")}
            text={t("an.kosongIsi")}
          />
        ) : (
          items.map((a) => (
            <Card
              key={a.id}
              a={a}
              openId={openId === a.id}
              onPress={() => setOpenId(openId === a.id ? null : a.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Card({
  a,
  openId,
  onPress,
}: {
  a: Announcement;
  openId: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isImportant = a.priority === "Important";
  return (
    <Pressable
      style={[styles.card, isImportant && { borderColor: c.warn.ink }]}
      onPress={onPress}
    >
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{a.title}</Text>
          <Text style={styles.meta}>
            {[
              a.publishedOn ? formatShortDateWithYear(a.publishedOn) : null,
              a.postedBy ? t("an.oleh", { nama: a.postedBy }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        {isImportant && (
          <View style={[styles.badge, { backgroundColor: c.warn.bg }]}>
            <Text style={[styles.badgeText, { color: c.warn.ink }]}>
              {t("an.penting")}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.body} numberOfLines={openId ? undefined : 3}>
        {a.content}
      </Text>
      {openId ? (
        <>
          <AttachmentList items={a.attachments} />
          {a.expiresOn ? (
            <Text style={styles.meta}>
              {t("an.berlaku", { tgl: formatShortDateWithYear(a.expiresOn) })}
            </Text>
          ) : null}
        </>
      ) : a.content.length > 120 ? (
        <Text style={styles.more}>{t("an.bacaSelengkapnya")}</Text>
      ) : null}
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
    list: { paddingHorizontal: 18, paddingBottom: 170 },
    card: {
      marginBottom: 10,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: 16,
    },
    head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    title: { fontSize: 14, fontWeight: "700", color: c.ink },
    meta: { fontSize: 10.5, fontWeight: "500", color: c.muted, marginTop: 3 },
    badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: "700" },
    body: {
      fontSize: 12.5,
      fontWeight: "500",
      color: c.ink,
      lineHeight: 19,
      marginTop: 10,
    },
    more: { fontSize: 11.5, fontWeight: "700", color: c.accent, marginTop: 8 },
  });
