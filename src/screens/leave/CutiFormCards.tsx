import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";

export const JENIS_CUTI = [
  "Tahunan",
  "Sakit",
  "Melahirkan",
  "Izin penting",
] as const;

export const NAMA_CUTI: Record<JenisCuti, string> = {
  Tahunan: "Cuti tahunan",
  Sakit: "Cuti sakit",
  Melahirkan: "Cuti melahirkan",
  "Izin penting": "Izin penting",
};

export type JenisCuti = (typeof JENIS_CUTI)[number];

function infoCuti(jenis: JenisCuti, saldo: number, hariKerja: number) {
  if (jenis === "Tahunan") {
    return hariKerja > saldo
      ? `Durasi melebihi saldo cuti (${saldo} hari). Kurangi tanggal atau ajukan cuti di luar tanggungan.`
      : `Saldo ${saldo} hari · setelah pengajuan ini sisa ${saldo - hariKerja} hari`;
  }
  if (jenis === "Sakit")
    return "Lampirkan surat dokter untuk cuti sakit lebih dari 1 hari. Tidak memotong saldo cuti tahunan.";
  if (jenis === "Melahirkan")
    return "Hak cuti 3 bulan sesuai UU Ketenagakerjaan. Lampirkan surat keterangan dokter atau bidan.";
  return "Untuk pernikahan, duka, atau keperluan keluarga. Tidak memotong saldo cuti tahunan.";
}

export function labelLampiran(jenis: JenisCuti) {
  return jenis === "Sakit" || jenis === "Melahirkan"
    ? "Surat dokter (wajib)"
    : "Lampiran (opsional)";
}

export function CutiTypeCard({
  jenis,
  onPick,
  saldo,
  hariKerja,
}: {
  jenis: JenisCuti;
  onPick: (j: JenisCuti) => void;
  saldo: number;
  hariKerja: number;
}) {
  const melebihi = jenis === "Tahunan" && hariKerja > saldo;
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Jenis cuti</Text>

      <View style={styles.chipWrap}>
        {JENIS_CUTI.map((j) => {
          const on = jenis === j;
          return (
            <Pressable
              key={j}
              onPress={() => onPick(j)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {j}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.infoBox,
          { backgroundColor: melebihi ? c.warn.bg : c.info.bg },
        ]}
      >
        <LineIcon
          d={ICON.info}
          color={melebihi ? c.warn.ink : c.info.ink}
          size={16}
        />
        <Text
          style={[
            styles.infoText,
            { color: melebihi ? c.warn.ink : c.info.ink },
          ]}
        >
          {infoCuti(jenis, saldo, hariKerja)}
        </Text>
      </View>
    </View>
  );
}

export function CutiDetailCard({
  jenis,
  alasan,
  onChangeAlasan,
}: {
  jenis: JenisCuti;
  alasan: string;
  onChangeAlasan: (v: string) => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>Detail pengajuan</Text>

      <Text style={styles.label}>Alasan</Text>
      <TextInput
        style={styles.textarea}
        value={alasan}
        onChangeText={onChangeAlasan}
        placeholder="Contoh: acara keluarga di Semarang"
        placeholderTextColor={c.mutedLabel}
        multiline
      />

      <Text style={styles.label}>{labelLampiran(jenis)}</Text>
      <Pressable style={styles.uploadBox}>
        <View style={styles.uploadIcon}>
          <LineIcon d={ICON.upload} color={c.info.ink} size={17} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle}>Unggah dokumen</Text>
          <Text style={styles.rowSub}>PDF atau JPG, maks. 5 MB</Text>
        </View>
      </Pressable>

      <Text style={styles.label}>Delegasi tugas</Text>
      <Pressable style={styles.delegateBox}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>FN</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle}>Fajar Nugroho</Text>
          <Text style={styles.rowSub}>Accounting Officer</Text>
        </View>
        <Text style={styles.changeText}>Ganti</Text>
      </Pressable>
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
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },

    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.fieldBorder,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 12, fontWeight: "600", color: c.ink },
    chipTextOn: { color: "#fff" },

    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 11,
      marginTop: 14,
    },
    infoText: { flex: 1, fontSize: 11.5, lineHeight: 17, fontWeight: "600" },

    label: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.mutedLabel,
      marginTop: 14,
    },
    textarea: {
      minHeight: 78,
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "500",
      color: c.ink,
      textAlignVertical: "top",
    },

    uploadBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 8,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.fieldBorder,
      borderRadius: 14,
      padding: 13,
    },
    uploadIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },

    delegateBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 11, fontWeight: "700", color: c.info.ink },

    rowTitle: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    rowSub: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },
    changeText: { fontSize: 11.5, fontWeight: "600", color: c.accent },
  });
