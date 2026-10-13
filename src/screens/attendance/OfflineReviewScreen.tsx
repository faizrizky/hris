import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { OfflineCheckin, OfflineReviewStatus } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { useSession } from "@/services/session";
import { useConfirm } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { ICON } from "@/constants/icons";
import { kembali } from "@/navigation/kembali";
import { tanggalPendek } from "@/utils/date";
import { useT } from "@/i18n";
import type { Kunci } from "@/i18n/id";

const FILTER: { key: OfflineReviewStatus | "all"; label: Kunci }[] = [
  { key: "Needs Review", label: "ofr.perlu" },
  { key: "Approved", label: "pcr.disetujui" },
  { key: "Rejected", label: "pcr.ditolak" },
  { key: "all", label: "pcr.semua" },
];

// "2026-10-12 08:30:00" -> "12 Okt · 08:30"
function waktu(s: string | null): string {
  if (!s) return "—";
  const [tgl, jam = ""] = s.replace("T", " ").split(" ");
  return `${tanggalPendek(tgl!)} · ${jam.slice(0, 5)}`;
}

// Atasan/HR: check-in offline yang ditandai server (jam HP berubah, tidak
// terverifikasi, kuota, dsb.). Menyetujui memakai jam yang diklaim karyawan;
// menolak membiarkan jam saat server menerimanya.
export function OfflineReviewScreen({ navigation }: any) {
  const t = useT();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();
  const [status, setStatus] = useState<OfflineReviewStatus | "all">(
    "Needs Review",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const daftar = useLoad(
    () =>
      hrisApi.getOfflineCheckins(
        status,
        employee?.role === "mss" ? "team" : undefined,
      ),
    `${status}-${employee?.role}`,
  );
  const items = daftar.data ?? [];

  const putuskan = async (
    x: OfflineCheckin,
    decision: "approve" | "reject",
  ) => {
    if (decision === "approve") {
      const ya = await confirm({
        title: t(x.claimedTime ? "ofr.setujuiJudul" : "ofr.terimaJudul"),
        message: x.claimedTime
          ? t("ofr.setujuiPesan", { jam: waktu(x.claimedTime) })
          : t("ofr.terimaPesan"),
        tone: "info",
        confirmText: t("pcr.setujui"),
        cancelText: t("umum.batal"),
      });
      if (!ya) return;
    }
    setBusy(x.id);
    setGalat(null);
    try {
      await hrisApi.decideOfflineCheckin(x.id, decision);
      daftar.ulangi();
    } catch (e) {
      setGalat(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>{t("ofr.judul")}</Text>
          <Text style={styles.headerSub}>{t("ofr.sub")}</Text>
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
        {galat ? <Text style={styles.galat}>{galat}</Text> : null}
        {daftar.error && !daftar.data ? (
          <ErrorState pesan={daftar.error} onUlangi={daftar.ulangi} />
        ) : daftar.memuat ? (
          <View style={{ gap: 10 }}>
            {[0, 1].map((i) => (
              <View key={i} style={styles.card}>
                <Skeleton width="55%" height={13} radius={4} />
                <Skeleton
                  width="80%"
                  height={10}
                  radius={4}
                  style={{ marginTop: 10 }}
                />
              </View>
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ICON.clock}
            title={t("ofr.kosongJudul")}
            text={t("ofr.kosongIsi")}
          />
        ) : (
          items.map((x) => (
            <View key={x.id} style={styles.card}>
              <View style={styles.head}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{x.employeeName}</Text>
                  <Text style={styles.meta}>
                    {x.logType === "IN" ? t("hm.clockIn") : t("hm.clockOut")}
                    {x.designation ? ` · ${x.designation}` : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        x.status === "Approved"
                          ? c.ok.bg
                          : x.status === "Rejected"
                            ? c.bad.bg
                            : c.warn.bg,
                      color:
                        x.status === "Approved"
                          ? c.ok.ink
                          : x.status === "Rejected"
                            ? c.bad.ink
                            : c.warn.ink,
                    },
                  ]}
                >
                  {t(
                    x.status === "Approved"
                      ? "pcr.disetujui"
                      : x.status === "Rejected"
                        ? "pcr.ditolak"
                        : "ofr.perlu",
                  )}
                </Text>
              </View>

              <View style={styles.box}>
                {x.claimedTime ? (
                  <Text style={styles.row}>
                    {t("ofr.diklaim")}:{" "}
                    <Text style={styles.bold}>{waktu(x.claimedTime)}</Text>
                  </Text>
                ) : null}
                <Text style={styles.row}>
                  {t("ofr.tercatat")}:{" "}
                  <Text style={styles.bold}>{waktu(x.time)}</Text>
                </Text>
                {x.skewSeconds !== 0 ? (
                  <Text style={styles.row}>
                    {t("ofr.selisihJam", {
                      n: Math.round(Math.abs(x.skewSeconds) / 60),
                    })}
                  </Text>
                ) : null}
                {x.geoStatus === "Outside" && x.distanceM !== null ? (
                  <Text style={styles.row}>
                    {t("ofr.jarak", {
                      m: x.distanceM,
                      lokasi: x.workLocation ?? "—",
                    })}
                  </Text>
                ) : null}
                {x.mocked ? (
                  <Text style={styles.flags}>{t("ofr.lokasiPalsu")}</Text>
                ) : null}
                {x.flags ? <Text style={styles.flags}>{x.flags}</Text> : null}
              </View>

              {x.status === "Needs Review" ? (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.rejectBtn}
                    disabled={busy === x.id}
                    onPress={() => putuskan(x, "reject")}
                  >
                    <Text style={styles.rejectText}>{t("pcr.tolak")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.approveBtn}
                    disabled={busy === x.id}
                    onPress={() => putuskan(x, "approve")}
                  >
                    <Text style={styles.approveText}>
                      {busy === x.id
                        ? t("umum.memproses")
                        : t("ofr.pakaiJamKlaim")}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
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
    galat: {
      color: c.bad.ink,
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 10,
    },
    card: {
      marginBottom: 10,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      padding: 15,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 10 },
    name: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    meta: { fontSize: 11, fontWeight: "500", color: c.muted, marginTop: 3 },
    badge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      fontSize: 10,
      fontWeight: "700",
      overflow: "hidden",
    },
    box: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.chip,
      gap: 5,
    },
    row: { fontSize: 12, fontWeight: "500", color: c.muted },
    bold: { fontWeight: "700", color: c.ink },
    flags: {
      fontSize: 11.5,
      fontWeight: "700",
      color: c.warn.ink,
      marginTop: 4,
    },
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
  });
