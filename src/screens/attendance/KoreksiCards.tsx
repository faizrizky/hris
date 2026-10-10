import React, { useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { PickerSheet } from "@/components/PickerSheet";
import { StatusBadge } from "@/components/StatusBadge";
import { AttendanceRecord } from "@/services/types";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
} from "@/constants/statusLabels";
import { jamMenit } from "@/utils/date";
import { BuktiFile } from "@/screens/leave/LemburFormCards";
import { useT, tt } from "@/i18n";

// Nilai ini ikut tersimpan di ERPNext (bahasa Inggris); tampilannya diterjemahkan.
export const JENIS_KOREKSI = [
  "Forgot check-in",
  "Forgot check-out",
  "App error",
  "Inaccurate GPS",
  "Off-site duty",
  "Other",
] as const;

// Pengajuan lama tersimpan dengan teks Indonesia.
const JENIS_LAMA: Record<string, JenisKoreksi> = {
  "Lupa absen masuk": "Forgot check-in",
  "Lupa absen keluar": "Forgot check-out",
  "Aplikasi gagal / error": "App error",
  "GPS tidak akurat": "Inaccurate GPS",
  "Dinas luar kantor": "Off-site duty",
  Lainnya: "Other",
};

export function namaJenisKoreksi(v: string): string {
  const baku = (JENIS_KOREKSI as readonly string[]).includes(v)
    ? (v as JenisKoreksi)
    : JENIS_LAMA[v];
  return baku ? tt(`kor.${baku}`) : v;
}

export type JenisKoreksi = (typeof JENIS_KOREKSI)[number];

const STEP = 15;

/* ---------- Data tercatat (read-only) ---------- */

export function TercatatCard({ record }: { record: AttendanceRecord | null }) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <View style={styles.headRow}>
        <Text style={styles.cardTitle}>{t("kor.dataTercatat")}</Text>
        {record ? (
          <StatusBadge
            label={ATTENDANCE_STATUS_LABEL[record.status]}
            tone={ATTENDANCE_STATUS_TONE[record.status]}
            variant="compact"
          />
        ) : (
          <StatusBadge label={t("kor.tanpaLog")} tone="bad" variant="compact" />
        )}
      </View>

      <Text style={styles.desc}>
        {record ? t("kor.descAda") : t("kor.descTanpa")}
      </Text>

      <View style={styles.timeRow}>
        <View style={styles.readBox}>
          <Text style={styles.label}>{t("kor.masuk")}</Text>
          <Text style={styles.readValue}>{record?.checkIn ?? "—"}</Text>
        </View>
        <View style={styles.readBox}>
          <Text style={styles.label}>{t("kor.keluar")}</Text>
          <Text style={styles.readValue}>{record?.checkOut ?? "—"}</Text>
        </View>
      </View>
    </View>
  );
}

/* ---------- Jam yang diajukan ---------- */

function StepBox({
  label,
  nilai,
  onChange,
}: {
  label: string;
  nilai: number;
  onChange: (v: number) => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.stepBox}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.timeValue}>{jamMenit(nilai)}</Text>
      </View>
      <Pressable style={styles.stepBtn} onPress={() => onChange(nilai - STEP)}>
        <Ionicons name="remove" size={15} color={c.ink} />
      </Pressable>
      <Pressable
        style={[styles.stepBtn, styles.stepBtnOn]}
        onPress={() => onChange(nilai + STEP)}
      >
        <Ionicons name="add" size={15} color="#fff" />
      </Pressable>
    </View>
  );
}

export function JamAjuanCard({
  masuk,
  keluar,
  onChangeMasuk,
  onChangeKeluar,
}: {
  masuk: number;
  keluar: number;
  onChangeMasuk: (v: number) => void;
  onChangeKeluar: (v: number) => void;
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <View style={styles.headRow}>
        <Text style={styles.cardTitle}>{t("kor.jamAjuan")}</Text>
        <View style={[styles.badge, { backgroundColor: c.info.bg }]}>
          <Text style={[styles.badgeText, { color: c.info.ink }]}>
            {t("kor.langkah", { n: STEP })}
          </Text>
        </View>
      </View>

      <View style={styles.timeRow}>
        <StepBox
          label={t("kor.masuk")}
          nilai={masuk}
          onChange={onChangeMasuk}
        />
        <StepBox
          label={t("kor.keluar")}
          nilai={keluar}
          onChange={onChangeKeluar}
        />
      </View>

      <Text style={styles.rule}>{t("kor.aturanJam")}</Text>
    </View>
  );
}

/* ---------- Alasan ---------- */

export function AlasanKoreksiCard({
  jenis,
  onPickJenis,
  alasan,
  onChangeAlasan,
}: {
  jenis: JenisKoreksi;
  onPickJenis: (v: JenisKoreksi) => void;
  alasan: string;
  onChangeAlasan: (v: string) => void;
}) {
  const [buka, setBuka] = useState(false);
  const panjang = alasan.trim().length;
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>{t("kor.alasan")}</Text>

      <Text style={[styles.label, { marginTop: 14 }]}>{t("kor.jenis")}</Text>
      <Pressable style={styles.selectBox} onPress={() => setBuka(true)}>
        <Text style={styles.selectText}>{namaJenisKoreksi(jenis)}</Text>
        <Ionicons name="chevron-down" size={15} color={c.muted} />
      </Pressable>

      <Text style={[styles.label, { marginTop: 14 }]}>
        {t("kor.penjelasan")}
      </Text>
      <TextInput
        style={styles.textarea}
        value={alasan}
        onChangeText={onChangeAlasan}
        placeholder={t("kor.contoh")}
        placeholderTextColor={c.mutedLabel}
        multiline
      />
      <Text style={[styles.counter, panjang < 15 && { color: c.bad.ink }]}>
        {t("kor.minimum", { n: panjang })}
      </Text>

      <PickerSheet
        visible={buka}
        title={t("kor.jenisKoreksi")}
        options={JENIS_KOREKSI}
        labelOf={namaJenisKoreksi}
        value={jenis}
        onSelect={(v) => onPickJenis(v as JenisKoreksi)}
        onClose={() => setBuka(false)}
      />
    </View>
  );
}

/* ---------- Bukti pendukung ---------- */

export function BuktiKoreksiCard({
  files,
  wajib,
  onAdd,
  onRemove,
}: {
  files: BuktiFile[];
  wajib: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const kurang = wajib && files.length === 0;
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <View style={styles.headRow}>
        <Text style={styles.cardTitle}>{t("kor.buktiPendukung")}</Text>
        <View
          style={[styles.badge, { backgroundColor: wajib ? c.bad.bg : c.chip }]}
        >
          <Text
            style={[styles.badgeText, { color: wajib ? c.bad.ink : c.muted }]}
          >
            {wajib ? t("kor.wajib") : t("kor.opsional")}
          </Text>
        </View>
      </View>
      <Text style={styles.desc}>{t("kor.buktiDesc")}</Text>

      <View style={{ gap: 8, marginTop: 12 }}>
        {files.map((f, i) => (
          <View key={`${f.name}-${i}`} style={styles.fileRow}>
            <View style={styles.fileIcon}>
              <LineIcon d={ICON.fileCheck} color={c.ok.ink} size={16} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.fileName}>{f.name}</Text>
              <Text style={styles.fileSize}>{f.size}</Text>
            </View>
            <Pressable style={styles.removeBtn} onPress={() => onRemove(i)}>
              <LineIcon d={ICON.close} color={c.muted} size={14} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={onAdd}
          style={[
            styles.addBox,
            { borderColor: kurang ? c.bad.ink : c.fieldBorder },
          ]}
        >
          <LineIcon
            d={ICON.upload}
            color={kurang ? c.bad.ink : c.muted}
            size={18}
          />
          <Text style={[styles.addText, kurang ? { color: c.bad.ink } : null]}>
            {t("kor.tambahLampiran")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardTitle: {
      flex: 1,
      fontSize: 13.5,
      fontWeight: "700",
      color: c.ink,
    },
    desc: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      lineHeight: 16,
      marginTop: 6,
    },
    badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontSize: 9.5, fontWeight: "700" },

    label: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.mutedLabel,
    },

    timeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    readBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      backgroundColor: c.chip,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    readValue: {
      fontSize: 17,
      fontWeight: "800",
      color: c.muted,
      marginTop: 4,
    },

    stepBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingLeft: 12,
      paddingRight: 8,
      paddingVertical: 10,
    },
    timeValue: {
      fontSize: 17,
      fontWeight: "800",
      color: c.ink,
      marginTop: 4,
    },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    stepBtnOn: { backgroundColor: c.accent },
    rule: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 10,
    },
    selectBox: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      marginTop: 7,
    },
    selectText: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: "600",
      color: c.ink,
    },

    textarea: {
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      marginTop: 7,
      minHeight: 92,
      fontSize: 12.5,
      color: c.ink,
      textAlignVertical: "top",
    },
    counter: {
      fontSize: 10,
      fontWeight: "600",
      color: c.mutedLabel,
      marginTop: 7,
      textAlign: "right",
    },

    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.chip,
      borderRadius: 14,
      padding: 10,
    },
    fileIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.ok.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    fileName: { fontSize: 12, fontWeight: "700", color: c.ink },
    fileSize: {
      fontSize: 10,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },
    removeBtn: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
    },

    addBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderStyle: "dashed",
      borderRadius: 14,
      paddingVertical: 16,
    },
    addText: { fontSize: 12, fontWeight: "700", color: c.muted },
  });
