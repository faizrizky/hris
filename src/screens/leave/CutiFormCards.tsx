import React, { useMemo, useState } from "react";
import { ColleagueSheet } from "@/components/ColleagueSheet";
import { Colleague } from "@/services/types";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { PickerSheet } from "@/components/PickerSheet";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT, translate } from "@/i18n";
import type { ProofAttachment } from "./LemburFormCards";

export const MAIN_KINDS = ["Tahunan", "Sakit", "Melahirkan"] as const;

// Izin penting menurut UU 13/2003 Pasal 93: dibayar, tidak memotong cuti tahunan.
export const IMPORTANT_LEAVE_KINDS = [
  "Menikah",
  "MenikahkanAnak",
  "KhitanBaptis",
  "IstriMelahirkan",
  "KeluargaInti",
  "SerumahMeninggal",
] as const;

export type LeaveKind =
  (typeof MAIN_KINDS)[number] | (typeof IMPORTANT_LEAVE_KINDS)[number];

export const isImportantLeave = (j: LeaveKind) =>
  (IMPORTANT_LEAVE_KINDS as readonly string[]).includes(j);

// Nama Leave Type di ERPNext untuk tiap jenis.
export const SERVER_KINDS: Record<LeaveKind, string> = {
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
export const MAX_DAYS: Partial<Record<LeaveKind, number>> = {
  Melahirkan: 90,
  Menikah: 3,
  MenikahkanAnak: 2,
  KhitanBaptis: 2,
  IstriMelahirkan: 2,
  KeluargaInti: 2,
  SerumahMeninggal: 1,
};

export const leaveName = (j: LeaveKind) => translate(`lr.jenisCutiNama.${j}`);

export const kindName = (j: LeaveKind) => translate(`lr.jenisCutiNama.${j}`);

function getLeaveInfo(kind: LeaveKind, balanceList: number, workdays: number) {
  const t = translate;
  if (kind === "Melahirkan")
    return t("fc.infoMelahirkan", { hari: MAX_DAYS.Melahirkan! });
  if (isImportantLeave(kind))
    return t("fc.infoPenting", { hari: MAX_DAYS[kind]! });
  if (kind === "Tahunan") {
    return workdays > balanceList
      ? t("fc.infoMelebihi", { saldo: balanceList })
      : t("fc.infoSaldo", { saldo: balanceList, sisa: balanceList - workdays });
  }
  return t("fc.infoSakit");
}

export function attachmentLabel(kind: LeaveKind) {
  return kind === "Sakit"
    ? translate("fc.lampiranSakit")
    : translate("fc.lampiranOpsional");
}

export function LeaveTypeCard({
  kind,
  onPick,
  balanceList,
  workdays,
  gender,
}: {
  kind: LeaveKind;
  onPick: (j: LeaveKind) => void;
  balanceList: number;
  workdays: number; // hari yang dihitung untuk jenis ini (kerja, atau kalender untuk melahirkan)
  gender: "F" | "M" | null;
}) {
  const isExceeding =
    (kind === "Tahunan" && workdays > balanceList) ||
    (MAX_DAYS[kind] !== undefined && workdays > MAX_DAYS[kind]!);
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [isImportantOpen, setIsImportantOpen] = useState(false);

  // Jenis yang hanya berlaku untuk satu jenis kelamin disembunyikan bagi yang lain.
  const mainKinds = MAIN_KINDS.filter(
    (j) => j !== "Melahirkan" || gender === "F",
  );
  const importantKinds = IMPORTANT_LEAVE_KINDS.filter(
    (j) => j !== "IstriMelahirkan" || gender === "M",
  );
  const isImportantActive = isImportantLeave(kind);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t("fc.jenisCuti")}</Text>

      <View style={styles.chipWrap}>
        {mainKinds.map((j) => {
          const isOn = kind === j;
          return (
            <Pressable
              key={j}
              onPress={() => onPick(j)}
              style={[styles.chip, isOn && styles.chipOn]}
            >
              <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                {kindName(j)}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setIsImportantOpen(true)}
          style={[styles.chip, isImportantActive && styles.chipOn]}
        >
          <Text
            style={[styles.chipText, isImportantActive && styles.chipTextOn]}
          >
            {isImportantActive ? kindName(kind) : t("fc.penting")}
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.infoBox,
          { backgroundColor: isExceeding ? c.warn.bg : c.info.bg },
        ]}
      >
        <LineIcon
          d={ICON.info}
          color={isExceeding ? c.warn.ink : c.info.ink}
          size={16}
        />
        <Text
          style={[
            styles.infoText,
            { color: isExceeding ? c.warn.ink : c.info.ink },
          ]}
        >
          {MAX_DAYS[kind] !== undefined && workdays > MAX_DAYS[kind]!
            ? t("fc.melebihiMaks", { hari: MAX_DAYS[kind]! })
            : getLeaveInfo(kind, balanceList, workdays)}
        </Text>
      </View>

      <PickerSheet
        visible={isImportantOpen}
        title={t("fc.pilihPenting")}
        options={importantKinds}
        value={isImportantActive ? kind : null}
        labelOf={(v) => kindName(v as LeaveKind)}
        onSelect={(v) => onPick(v as LeaveKind)}
        onClose={() => setIsImportantOpen(false)}
      />
    </View>
  );
}

export function LeaveDetailCard({
  kind,
  reason,
  onChangeReason,
  colleagues,
  delegate,
  onPickDelegate,
  files,
  onAdd,
  onRemove,
}: {
  kind: LeaveKind;
  reason: string;
  onChangeReason: (v: string) => void;
  colleagues: Colleague[];
  delegate: Colleague | null;
  onPickDelegate: (v: Colleague) => void;
  files: ProofAttachment[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const c = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>{t("fc.detail")}</Text>

      <Text style={styles.label}>{t("fc.alasan")}</Text>
      <TextInput
        style={styles.textarea}
        value={reason}
        onChangeText={onChangeReason}
        placeholder={t("fc.alasanContoh")}
        placeholderTextColor={c.mutedLabel}
        multiline
      />

      <Text style={styles.label}>{attachmentLabel(kind)}</Text>
      {files.map((f, i) => (
        <View key={`${f.name}-${i}`} style={styles.fileRow}>
          <LineIcon d={ICON.fileCheck} color={c.ok.ink} size={16} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {f.name}
            </Text>
            <Text style={styles.rowSub}>{f.size}</Text>
          </View>
          <Pressable onPress={() => onRemove(i)} hitSlop={8}>
            <LineIcon d={ICON.close} color={c.muted} size={14} />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.uploadBox} onPress={onAdd}>
        <View style={styles.uploadIcon}>
          <LineIcon d={ICON.upload} color={c.info.ink} size={17} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle}>
            {files.length ? t("fc.tambahDok") : t("fc.unggahDok")}
          </Text>
          <Text style={styles.rowSub}>{t("fc.pdfJpg")}</Text>
        </View>
      </Pressable>

      <Text style={styles.label}>{t("fc.delegasi")}</Text>
      <Pressable style={styles.delegateBox} onPress={() => setIsOpen(true)}>
        {delegate ? (
          <>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{delegate.initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{delegate.fullName}</Text>
              <Text style={styles.rowSub}>{delegate.jobTitle}</Text>
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
                {t("fc.rekan", { n: colleagues.length })}
              </Text>
            </View>
            <Text style={styles.changeText}>{t("fc.pilih")}</Text>
          </>
        )}
      </Pressable>

      <ColleagueSheet
        visible={isOpen}
        options={colleagues}
        value={delegate}
        onSelect={onPickDelegate}
        onClose={() => setIsOpen(false)}
      />
    </View>
  );
}
const makeStyles = (c: Palette) =>
  StyleSheet.create({
    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 11,
      borderRadius: 14,
      backgroundColor: c.ok.bg,
      marginBottom: 8,
    },
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

    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 8,
      marginTop: 12,
    },
    chip: {
      width: "48.5%", // dua kolom sama lebar, rapi di semua bahasa
      height: 44,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: c.ink,
      textAlign: "center",
    },
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
