import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { colors } from "@/theme/colors";

export interface BuktiFile {
  name: string;
  size: string;
}

export function LemburJamCard({
  holiday,
  startLabel,
  endLabel,
  rule,
  onMinus,
  onPlus,
}: {
  holiday: boolean;
  startLabel: string;
  endLabel: string;
  rule: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <View style={styles.headRow}>
        <Text style={styles.cardTitle}>Jam lembur</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: holiday ? colors.warn.bg : colors.info.bg },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: holiday ? colors.warn.ink : colors.info.ink },
            ]}
          >
            {holiday ? "Hari libur" : "Hari kerja"}
          </Text>
        </View>
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeBox}>
          <Text style={styles.label}>Mulai</Text>
          <Text style={styles.timeValue}>{startLabel}</Text>
        </View>

        <View style={styles.timeBoxWide}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Selesai</Text>
            <Text style={styles.timeValue}>{endLabel}</Text>
          </View>
          <Pressable style={styles.stepMinus} onPress={onMinus}>
            <View style={styles.barDark} />
          </Pressable>
          <Pressable style={styles.stepPlus} onPress={onPlus}>
            <View style={styles.barLight} />
            <View style={styles.barLightV} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.rule}>{rule}</Text>
    </View>
  );
}

export function LemburUraianCard({
  uraian,
  onChange,
}: {
  uraian: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <Text style={styles.cardTitle}>Uraian pekerjaan</Text>
      <TextInput
        style={styles.textarea}
        value={uraian}
        onChangeText={onChange}
        placeholder="Contoh: closing laporan keuangan bulanan"
        placeholderTextColor={colors.mutedLabel}
        multiline
      />
    </View>
  );
}

export function LemburBuktiCard({
  files,
  onAdd,
  onRemove,
}: {
  files: BuktiFile[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const kosong = files.length === 0;

  return (
    <View style={[styles.card, { marginTop: 12 }]}>
      <View style={styles.headRow}>
        <Text style={styles.cardTitle}>Bukti lembur</Text>
        <View style={[styles.badge, { backgroundColor: colors.bad.bg }]}>
          <Text style={[styles.badgeText, { color: colors.bad.ink }]}>
            Wajib
          </Text>
        </View>
      </View>
      <Text style={styles.desc}>
        Foto hasil kerja, screenshot sistem, atau surat perintah lembur
      </Text>

      <View style={{ gap: 8, marginTop: 12 }}>
        {files.map((f, i) => (
          <View key={`${f.name}-${i}`} style={styles.fileRow}>
            <View style={styles.fileIcon}>
              <LineIcon d={ICON.fileCheck} color={colors.ok.ink} size={16} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.fileName}>{f.name}</Text>
              <Text style={styles.fileSize}>{f.size}</Text>
            </View>
            <Pressable style={styles.removeBtn} onPress={() => onRemove(i)}>
              <LineIcon d={ICON.close} color={colors.muted} size={14} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={onAdd}
          style={[
            styles.addBox,
            { borderColor: kosong ? colors.bad.ink : colors.fieldBorder },
          ]}
        >
          <View style={styles.addIcon}>
            <LineIcon d={ICON.upload} color={colors.info.ink} size={17} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.fileName}>
              {kosong ? "Unggah bukti lembur" : "Tambah file lain"}
            </Text>
            <Text style={styles.fileSize}>JPG, PNG, atau PDF · maks. 5 MB</Text>
          </View>
        </Pressable>
      </View>
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
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  desc: {
    fontSize: 10.5,
    lineHeight: 16,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 4,
  },

  timeRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  timeBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  timeBoxWide: {
    flex: 1.45,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: 14,
    paddingLeft: 13,
    paddingRight: 8,
    paddingVertical: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.mutedLabel,
  },
  timeValue: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 4,
  },
  stepMinus: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPlus: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  barDark: {
    width: 11,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.ink,
  },
  barLight: {
    position: "absolute",
    width: 11,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#fff",
  },
  barLightV: {
    position: "absolute",
    width: 2,
    height: 11,
    borderRadius: 1,
    backgroundColor: "#fff",
  },
  rule: {
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 10,
  },

  textarea: {
    minHeight: 78,
    marginTop: 10,
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

  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 10,
  },
  fileIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.ok.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  fileSize: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 2,
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  addBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 13,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.info.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
