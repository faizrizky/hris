import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { colors } from "@/theme/colors";

export const JENIS_CUTI = [
  "Tahunan",
  "Sakit",
  "Melahirkan",
  "Izin penting",
] as const;

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
          { backgroundColor: melebihi ? colors.warn.bg : colors.info.bg },
        ]}
      >
        <LineIcon
          d={ICON.info}
          color={melebihi ? colors.warn.ink : colors.info.ink}
          size={16}
        />
        <Text
          style={[
            styles.infoText,
            { color: melebihi ? colors.warn.ink : colors.info.ink },
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
  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>Detail pengajuan</Text>

      <Text style={styles.label}>Alasan</Text>
      <TextInput
        style={styles.textarea}
        value={alasan}
        onChangeText={onChangeAlasan}
        placeholder="Contoh: acara keluarga di Semarang"
        placeholderTextColor={colors.mutedLabel}
        multiline
      />

      <Text style={styles.label}>{labelLampiran(jenis)}</Text>
      <Pressable style={styles.uploadBox}>
        <View style={styles.uploadIcon}>
          <LineIcon d={ICON.upload} color={colors.info.ink} size={17} />
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
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 22,
    padding: 16,
    shadowColor: "#0F1720",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.ink },
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
    color: colors.mutedLabel,
    marginTop: 14,
  },
  textarea: {
    minHeight: 78,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    color: colors.ink,
    textAlignVertical: "top",
  },

  uploadBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.fieldBorder,
    borderRadius: 14,
    padding: 13,
  },
  uploadIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.info.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  delegateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.info.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 11, fontWeight: "700", color: colors.info.ink },

  rowTitle: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  rowSub: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 2,
  },
  changeText: { fontSize: 11.5, fontWeight: "600", color: colors.accent },
});
