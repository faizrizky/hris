import { useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealFlatList as FlatList } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useLoad } from "@/hooks/useLoad";
import { ErrorState } from "@/components/ErrorState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { StatusBadge } from "@/components/StatusBadge";
import { LineIcon } from "@/components/LineIcon";
import { Skeleton } from "@/components/Skeleton";
import { ICON } from "@/constants/icons";
import { AttendanceRequestedStatus } from "@/services/types";
import {
  CORRECTION_STATUS_LABEL as STATUS_LABEL,
  CORRECTION_STATUS_TONE as STATUS_TONE,
} from "@/constants/statusLabels";
import { pisahAlasan } from "@/utils/Correction";
import { bulanSingkat, namaHari, tanggalAngka } from "@/utils/date";
import { namaJenisKoreksi } from "./KoreksiCards";
import { useT } from "@/i18n";
import { LampiranList } from "@/screens/leave/LampiranList";
import type { Kunci } from "@/i18n/id";

type Filter = "semua" | AttendanceRequestedStatus;

const CHIPS: { key: Filter; label: Kunci }[] = [
  { key: "semua", label: "kor.semua" },
  { key: "pending", label: "st.menunggu" },
  { key: "approved", label: "st.disetujui" },
  { key: "rejected", label: "st.ditolak" },
];

export function AttendanceCorrectionHistoryScreen({ navigation }: any) {
  const t = useT();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const koreksi = useLoad(
    () =>
      employee
        ? hrisApi.getAttendanceCorrections(employee.id)
        : Promise.resolve([]),
    employee?.id,
  );
  const records = koreksi.data;
  const [filter, setFilter] = useState<Filter>("semua");
  const [buka, setBuka] = useState<string | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // useLoad memuat ulang tiap layar kembali fokus, jadi koreksi yang baru
  // dikirim langsung muncul.
  const memuat = koreksi.memuat;
  const semua = records ?? [];

  const hitung = (s: AttendanceRequestedStatus) =>
    semua.filter((r) => r.status === s).length;

  const pending = hitung("pending");
  const approved = hitung("approved");
  const rejected = hitung("rejected");
  const total = semua.length;

  const filtered = semua.filter(
    (r) => filter === "semua" || r.status === filter,
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("kor.hJudul")}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={styles.addBtn}
          onPress={() => navigation.navigate("AttendanceCorrection")}
        >
          <LineIcon d={ICON.plus} color="#fff" size={13} />
          <Text style={styles.addText}>{t("kor.ajukan")}</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {CHIPS.map((c) => {
          const on = filter === c.key;
          const n =
            c.key === "semua"
              ? total
              : hitung(c.key as AttendanceRequestedStatus);
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t(c.label)}
                {n > 0 ? ` ${n}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          total > 0 ? (
            <View style={styles.recapCard}>
              <Text style={styles.recapLabel}>{t("kor.ringkasan")}</Text>

              <View style={styles.recapRow}>
                <Recap
                  value={pending}
                  label={t("st.menunggu")}
                  color={c.warn.ink}
                />
                <Recap
                  value={approved}
                  label={t("st.disetujui")}
                  color={c.ok.ink}
                />
                <Recap
                  value={rejected}
                  label={t("st.ditolak")}
                  color={c.bad.ink}
                />
              </View>

              <View style={styles.bar}>
                {approved > 0 && (
                  <View style={{ flex: approved, backgroundColor: c.ok.ink }} />
                )}
                {pending > 0 && (
                  <View
                    style={{ flex: pending, backgroundColor: c.warn.ink }}
                  />
                )}
                {rejected > 0 && (
                  <View
                    style={{ flex: rejected, backgroundColor: c.bad.ink }}
                  />
                )}
              </View>

              <Text style={styles.recapNote}>
                {pending > 0
                  ? t("kor.masihMenunggu", { n: pending })
                  : t("kor.semuaPutus")}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          koreksi.error && !records ? (
            <ErrorState pesan={koreksi.error} onUlangi={koreksi.ulangi} />
          ) : memuat ? (
            <>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skelRow}>
                  <Skeleton width={40} height={40} radius={13} />
                  <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                    <Skeleton width="48%" height={12} radius={4} />
                    <Skeleton width="80%" height={10} radius={4} />
                  </View>
                  <Skeleton width={58} height={20} radius={8} />
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <LineIcon d={ICON.fileCheck} color={c.muted} size={22} />
              </View>
              <Text style={styles.emptyTitle}>
                {total === 0 ? t("kor.kosongJudul") : t("kor.tidakCocok")}
              </Text>
              <Text style={styles.emptyText}>
                {total === 0 ? t("kor.kosongIsi") : t("kor.gantiFilter")}
              </Text>
              {total === 0 && (
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => navigation.navigate("AttendanceCorrection")}
                >
                  <Text style={styles.emptyBtnText}>
                    {t("kor.ajukanKoreksi")}
                  </Text>
                </Pressable>
              )}
            </View>
          )
        }
        renderItem={({ item }) => {
          const { jenis, catatan } = pisahAlasan(item.reason);
          const terbuka = buka === item.id;

          return (
            <Pressable
              style={styles.row}
              onPress={() => setBuka(terbuka ? null : item.id)}
            >
              <View style={styles.rowTop}>
                <View style={styles.dateChip}>
                  <Text style={styles.dateDay}>{tanggalAngka(item.date)}</Text>
                  <Text style={styles.dateMonth}>
                    {bulanSingkat(item.date)}
                  </Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {namaJenisKoreksi(jenis)}
                  </Text>
                  <Text style={styles.rowDetail}>
                    {namaHari(item.date)} · {item.requestedCheckIn} –{" "}
                    {item.requestedCheckOut}
                  </Text>
                </View>

                <StatusBadge
                  label={STATUS_LABEL[item.status]}
                  tone={STATUS_TONE[item.status]}
                  variant="compact"
                />
                <Ionicons
                  name={terbuka ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={c.mutedLabel}
                />
              </View>

              {terbuka && (
                <View style={styles.rowBody}>
                  <Text style={styles.bodyLabel}>{t("kor.penjelasan")}</Text>
                  <Text style={styles.bodyText}>{catatan || "—"}</Text>

                  <Text style={[styles.bodyLabel, { marginTop: 11 }]}>
                    {t("kor.dokErp")}
                  </Text>
                  <Text style={styles.bodyDoc}>
                    Attendance Request · HR-ATR-{item.id}
                  </Text>
                  <LampiranList items={item.attachments} />
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function Recap({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.recapValue, { color }]}>{value}</Text>
      <Text style={styles.recapCaption}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    skelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 20,
      padding: 14,
      marginBottom: 10,
    },
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 16,
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
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.accent,
    },
    addText: { fontSize: 11.5, fontWeight: "600", color: c.card },

    chipRow: {
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 18,
      paddingBottom: 14,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: c.chip,
    },
    chipOn: { backgroundColor: c.accent },
    chipText: { fontSize: 12, fontWeight: "600", color: c.muted },
    chipTextOn: { color: c.card },

    list: { paddingHorizontal: 18, paddingBottom: 130 },

    recapCard: {
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: 16,
      marginBottom: 14,
    },
    recapLabel: { fontSize: 11, fontWeight: "500", color: c.muted },
    recapRow: { flexDirection: "row", gap: 12, marginTop: 10 },
    recapValue: { fontSize: 20, lineHeight: 21, fontWeight: "800" },
    recapCaption: {
      fontSize: 10,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },
    bar: {
      flexDirection: "row",
      height: 6,
      borderRadius: 3,
      overflow: "hidden",
      backgroundColor: c.track,
      marginTop: 14,
    },
    recapNote: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 10,
    },

    row: {
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingVertical: 14,
      paddingHorizontal: 15,
      marginBottom: 10,
    },
    rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    dateChip: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    dateDay: {
      fontSize: 14,
      lineHeight: 15,
      fontWeight: "800",
      color: c.ink,
    },
    dateMonth: {
      fontSize: 8,
      fontWeight: "600",
      color: c.muted,
      marginTop: 2,
    },
    rowTitle: { fontSize: 13, fontWeight: "700", color: c.ink },
    rowDetail: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    rowBody: {
      marginTop: 13,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    bodyLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.mutedLabel,
    },
    bodyText: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.ink,
      lineHeight: 17,
      marginTop: 5,
    },
    bodyDoc: {
      fontSize: 11,
      fontWeight: "700",
      color: c.accent,
      marginTop: 5,
    },

    emptyCard: {
      alignItems: "center",
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingVertical: 32,
      paddingHorizontal: 24,
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
    emptyBtn: {
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: c.accent,
      marginTop: 16,
    },
    emptyBtnText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  });
