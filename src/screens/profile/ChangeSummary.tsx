import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import type { Kunci } from "@/i18n/id";
import { ProfileChange } from "@/services/types";
import { tanggalPendekTahun } from "@/utils/date";

const FIELD: Record<string, Kunci> = {
  phone: "pc.f.phone",
  personal_email: "pc.f.personal_email",
  address: "pc.f.address",
  emergency_contacts: "pc.f.emergency_contacts",
  family: "pc.f.family",
};

// Ringkasan satu permintaan perubahan: status, alasan, dan perbandingan
// nilai sekarang dengan usulan per bidang. Dipakai riwayat karyawan dan tinjauan HR.
export function ChangeSummary({
  p,
  tanpaStatus,
}: {
  p: ProfileChange;
  tanpaStatus?: boolean;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tone =
    p.status === "Approved" ? c.ok : p.status === "Rejected" ? c.bad : c.warn;
  const label =
    p.status === "Approved"
      ? t("pcr.disetujui")
      : p.status === "Rejected"
        ? t("pcr.ditolak")
        : t("pcr.menunggu");
  const kosong = t("pc.kosong");

  return (
    <View style={styles.wrap}>
      {!tanpaStatus && (
        <View style={styles.head}>
          <Text style={styles.date}>
            {p.createdOn ? tanggalPendekTahun(p.createdOn) : "—"}
          </Text>
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.badgeText, { color: tone.ink }]}>{label}</Text>
          </View>
        </View>
      )}
      <Text style={styles.reason}>{p.reason}</Text>
      {p.changes.map((x) => (
        <View key={x.field} style={styles.change}>
          <Text style={styles.field}>{t(FIELD[x.field] ?? "pc.f.phone")}</Text>
          <Text style={styles.now}>
            {t("pc.dari")}: {x.current || kosong}
          </Text>
          <Text style={styles.next}>
            {t("pc.menjadi")}: {x.proposed || kosong}
          </Text>
        </View>
      ))}
      {p.hrNote ? (
        <Text style={styles.note}>
          {t("pc.catatan")}: {p.hrNote}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    head: { flexDirection: "row", justifyContent: "space-between" },
    date: { fontSize: 11, fontWeight: "600", color: c.muted },
    badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: "700" },
    reason: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    change: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: c.chip,
      gap: 3,
    },
    field: { fontSize: 11, fontWeight: "700", color: c.info.ink },
    now: { fontSize: 11.5, fontWeight: "500", color: c.muted },
    next: { fontSize: 11.5, fontWeight: "700", color: c.ink },
    note: { fontSize: 11.5, fontWeight: "600", color: c.bad.ink },
  });
