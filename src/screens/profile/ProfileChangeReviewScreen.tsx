import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { ChangeStatus, ProfileChange } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { ICON } from "@/constants/icons";
import { inisial } from "@/utils/ProfileCompleteness";
import { tanggalPendekTahun } from "@/utils/date";
import { useT } from "@/i18n";
import type { Kunci } from "@/i18n/id";
import { kembali } from "@/navigation/kembali";

const FILTER: { key: ChangeStatus | "all"; label: Kunci }[] = [
  { key: "all", label: "pcr.semua" },
  { key: "Pending", label: "pcr.menunggu" },
  { key: "Approved", label: "pcr.disetujui" },
  { key: "Rejected", label: "pcr.ditolak" },
];

// HR: daftar permintaan perubahan data pribadi dari karyawan.
export function ProfileChangeReviewScreen({ navigation }: any) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [status, setStatus] = useState<ChangeStatus | "all">("Pending");
  const daftar = useLoad(
    () => hrisApi.getProfileChangesForReview(status),
    status,
  );
  const items = daftar.data ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>{t("pcr.judul")}</Text>
          <Text style={styles.headerSub}>{t("pcr.sub")}</Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {FILTER.map((f) => {
          const on = status === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setStatus(f.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t(f.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {daftar.error && !daftar.data ? (
          <ErrorState pesan={daftar.error} onUlangi={daftar.ulangi} />
        ) : daftar.memuat ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.row}>
                <Skeleton width={44} height={44} radius={22} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton width="58%" height={12} radius={4} />
                  <Skeleton width="80%" height={10} radius={4} />
                </View>
              </View>
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ICON.user}
            title={t("pcr.kosongJudul")}
            text={t("pcr.kosongIsi")}
          />
        ) : (
          items.map((p) => (
            <Baris
              key={p.id}
              p={p}
              onPress={() =>
                navigation.navigate("ProfileChangeReviewDetail", { change: p })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Baris({ p, onPress }: { p: ProfileChange; onPress: () => void }) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tone =
    p.status === "Approved" ? c.ok : p.status === "Rejected" ? c.bad : c.warn;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{inisial(p.employeeName ?? "?")}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {p.employeeName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {p.reason}
        </Text>
        <Text style={styles.meta}>
          {p.createdOn ? tanggalPendekTahun(p.createdOn) : "—"} ·{" "}
          {p.changes.length}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
        <Text style={[styles.badgeText, { color: tone.ink }]}>
          {t(
            p.status === "Approved"
              ? "pcr.disetujui"
              : p.status === "Rejected"
                ? "pcr.ditolak"
                : "pcr.menunggu",
          )}
        </Text>
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
    chipRow: {
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 18,
      marginBottom: 12,
    },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 11.5, fontWeight: "600", color: c.muted },
    chipTextOn: { color: "#fff" },
    list: { paddingHorizontal: 18, paddingBottom: 130 },
    row: {
      marginBottom: 10,
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
  });
