import React, { useMemo, useState } from "react";
import { ColleagueSheet } from "@/components/ColleagueSheet";
import { Colleague } from "@/services/types";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { PickerSheet } from "@/components/PickerSheet";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT, tt } from "@/i18n";

export const JENIS_UTAMA = ["Tahunan", "Sakit", "Melahirkan"] as const;

// Izin penting menurut UU 13/2003 Pasal 93: dibayar, tidak memotong cuti tahunan.
export const IZIN_PENTING = [
  "Menikah",
  "MenikahkanAnak",
  "KhitanBaptis",
  "IstriMelahirkan",
  "KeluargaInti",
  "SerumahMeninggal",
] as const;

export type JenisCuti =
  (typeof JENIS_UTAMA)[number] | (typeof IZIN_PENTING)[number];

export const adalahIzinPenting = (j: JenisCuti) =>
  (IZIN_PENTING as readonly string[]).includes(j);

// Nama Leave Type di ERPNext untuk tiap jenis.
export const JENIS_SERVER: Record<JenisCuti, string> = {
  Tahunan: "Annual Leave",
  Sakit: "Sick Leave",
  Melahirkan: "Maternity Leave",
  Menikah: "Marriage Leave",
  MenikahkanAnak: "Child Marriage Leave",
  KhitanBaptis: "Child Circumcision or Baptism Leave",
  IstriMelahirkan: "Spouse Childbirth Leave",
  KeluargaInti: "Bereavement Leave - Immediate Family",
  SerumahMeninggal: "Bereavement Leave - Household Member",
};

// Batas hari per pengajuan (sama dengan Leave Type di server).
export const HARI_MAKS: Partial<Record<JenisCuti, number>> = {
  Melahirkan: 90,
  Menikah: 3,
  MenikahkanAnak: 2,
  KhitanBaptis: 2,
  IstriMelahirkan: 2,
  KeluargaInti: 2,
  SerumahMeninggal: 1,
};

export const namaCuti = (j: JenisCuti) => tt(`lr.jenisCutiNama.${j}`);

export const namaJenis = (j: JenisCuti) => tt(`lr.jenisCutiNama.${j}`);

function infoCuti(jenis: JenisCuti, saldo: number, hariKerja: number) {
  const t = tt;
  if (jenis === "Melahirkan")
    return t("fc.infoMelahirkan", { hari: HARI_MAKS.Melahirkan! });
  if (adalahIzinPenting(jenis))
    return t("fc.infoPenting", { hari: HARI_MAKS[jenis]! });
  if (jenis === "Tahunan") {
    return hariKerja > saldo
      ? t("fc.infoMelebihi", { saldo })
      : t("fc.infoSaldo", { saldo, sisa: saldo - hariKerja });
  }
  return t("fc.infoSakit");
}

export function labelLampiran(jenis: JenisCuti) {
  return jenis === "Sakit" ? tt("fc.lampiranSakit") : tt("fc.lampiranOpsional");
}

export function CutiTypeCard({
  jenis,
  onPick,
  saldo,
  hariKerja,
  gender,
}: {
  jenis: JenisCuti;
  onPick: (j: JenisCuti) => void;
  saldo: number;
  hariKerja: number; // hari yang dihitung untuk jenis ini (kerja, atau kalender untuk melahirkan)
  gender: "F" | "M" | null;
}) {
  const melebihi =
    (jenis === "Tahunan" && hariKerja > saldo) ||
    (HARI_MAKS[jenis] !== undefined && hariKerja > HARI_MAKS[jenis]!);
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [bukaPenting, setBukaPenting] = useState(false);

  // Jenis yang hanya berlaku untuk satu jenis kelamin disembunyikan bagi yang lain.
  const utama = JENIS_UTAMA.filter((j) => j !== "Melahirkan" || gender === "F");
  const penting = IZIN_PENTING.filter(
    (j) => j !== "IstriMelahirkan" || gender === "M",
  );
  const pentingAktif = adalahIzinPenting(jenis);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("fc.jenisCuti")}</Text>

      <View style={styles.chipWrap}>
        {utama.map((j) => {
          const on = jenis === j;
          return (
            <Pressable
              key={j}
              onPress={() => onPick(j)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {namaJenis(j)}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setBukaPenting(true)}
          style={[styles.chip, pentingAktif && styles.chipOn]}
        >
          <Text style={[styles.chipText, pentingAktif && styles.chipTextOn]}>
            {pentingAktif ? namaJenis(jenis) : t("fc.penting")}
          </Text>
        </Pressable>
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
          {HARI_MAKS[jenis] !== undefined && hariKerja > HARI_MAKS[jenis]!
            ? t("fc.melebihiMaks", { hari: HARI_MAKS[jenis]! })
            : infoCuti(jenis, saldo, hariKerja)}
        </Text>
      </View>

      <PickerSheet
        visible={bukaPenting}
        title={t("fc.pilihPenting")}
        options={penting}
        value={pentingAktif ? jenis : null}
        labelOf={(v) => namaJenis(v as JenisCuti)}
        onSelect={(v) => onPick(v as JenisCuti)}
        onClose={() => setBukaPenting(false)}
      />
    </View>
  );
}

export function CutiDetailCard({
  jenis,
  alasan,
  onChangeAlasan,
  rekan,
  delegasi,
  onPickDelegasi,
}: {
  jenis: JenisCuti;
  alasan: string;
  onChangeAlasan: (v: string) => void;
  rekan: Colleague[];
  delegasi: Colleague | null;
  onPickDelegasi: (v: Colleague) => void;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [buka, setBuka] = useState(false);

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>{t("fc.detail")}</Text>

      <Text style={styles.label}>{t("fc.alasan")}</Text>
      <TextInput
        style={styles.textarea}
        value={alasan}
        onChangeText={onChangeAlasan}
        placeholder={t("fc.alasanContoh")}
        placeholderTextColor={c.mutedLabel}
        multiline
      />

      <Text style={styles.label}>{labelLampiran(jenis)}</Text>
      <Pressable style={styles.uploadBox}>
        <View style={styles.uploadIcon}>
          <LineIcon d={ICON.upload} color={c.info.ink} size={17} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle}>{t("fc.unggahDok")}</Text>
          <Text style={styles.rowSub}>{t("fc.pdfJpg")}</Text>
        </View>
      </Pressable>

      <Text style={styles.label}>{t("fc.delegasi")}</Text>
      <Pressable style={styles.delegateBox} onPress={() => setBuka(true)}>
        {delegasi ? (
          <>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{delegasi.initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{delegasi.fullName}</Text>
              <Text style={styles.rowSub}>{delegasi.jobTitle}</Text>
            </View>
            <Text style={styles.changeText}>{t("fc.ganti")}</Text>
          </>
        ) : (
          <>
            <View style={[styles.avatar, { backgroundColor: c.chip }]}>
              <LineIcon d={ICON.user} color={c.muted} size={18} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{t("fc.belumDipilih")}</Text>
              <Text style={styles.rowSub}>
                {t("fc.rekan", { n: rekan.length })}
              </Text>
            </View>
            <Text style={styles.changeText}>{t("fc.pilih")}</Text>
          </>
        )}
      </Pressable>

      <ColleagueSheet
        visible={buka}
        options={rekan}
        value={delegasi}
        onSelect={onPickDelegasi}
        onClose={() => setBuka(false)}
      />
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
