import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { DatePickerCard, FooterItem } from "@/components/DatePickerCard";
import {
  tanggalPendek,
  hitungHari,
  hitungHariKerja,
  fromISODate,
} from "@/utils/date";

const SEGMENTS = [
  { key: "cuti", label: "Cuti" },
  { key: "lembur", label: "Lembur" },
  { key: "dinas", label: "Dinas Luar" },
] as const;

export type FormKind = (typeof SEGMENTS)[number]["key"];

const FORM_META: Record<FormKind, { title: string; subtitle: string }> = {
  cuti: { title: "Pengajuan Cuti", subtitle: "Leave Application" },
  lembur: { title: "Pengajuan Lembur", subtitle: "Overtime Request" },
  dinas: { title: "Pengajuan Dinas Luar", subtitle: "Travel Request" },
};

export function LeaveRequestScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<FormKind>(route?.params?.kind ?? "cuti");

  const meta = FORM_META[kind];

  const isSingle = kind === "lembur";

  // Cuti & Dinas berbagi rentang; Lembur punya tanggal tunggalnya sendiri.
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [otDate, setOtDate] = useState<string | null>(null);

  const start = isSingle ? otDate : rangeStart;
  const end = isSingle ? otDate : rangeEnd;
  const range = start && end;

  const handleDateChange = (s: string | null, e: string | null) => {
    if (isSingle) {
      setOtDate(s);
    } else {
      setRangeStart(s);
      setRangeEnd(e);
    }
  };

  const calTitle =
    kind === "dinas"
      ? "Tanggal perjalanan"
      : kind === "lembur"
        ? "Tanggal lembur"
        : "Tanggal cuti";

  const calHint = isSingle
    ? "Ketuk satu tanggal"
    : "Ketuk tanggal mulai, lalu tanggal selesai";

  const footer: FooterItem[] = isSingle
    ? [
        { label: "Tanggal", value: start ? tanggalPendek(start) : "Pilih" },
        {
          label: "Jenis hari",
          value: start
            ? [0, 6].includes(fromISODate(start).getDay())
              ? "Hari libur"
              : "Hari kerja"
            : "—",
        },
        { label: "Durasi", value: "—", accent: true },
      ]
    : [
        { label: "Mulai", value: start ? tanggalPendek(start) : "Pilih" },
        { label: "Selesai", value: end ? tanggalPendek(end) : "Pilih" },
        {
          label: "Durasi",
          value: range
            ? kind === "dinas"
              ? `${hitungHari(start!, end!)} hari`
              : `${hitungHariKerja(start!, end!)} hari kerja`
            : "—",
          accent: true,
        },
      ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle}>{meta.title}</Text>
            <Text style={styles.headerSub}>{meta.subtitle}</Text>
          </View>
        </View>

        <View style={styles.segment}>
          {SEGMENTS.map((s) => {
            const on = kind === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setKind(s.key)}
                style={[styles.segBtn, on && styles.segBtnOn]}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <DatePickerCard
            key={kind}
            mode={isSingle ? "single" : "range"}
            title={calTitle}
            hint={calHint}
            start={start}
            end={end}
            onChange={handleDateChange}
            footer={footer}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sumSub}>Belum lengkap</Text>
          <Text style={styles.sumTop}>—</Text>
        </View>
        <Pressable style={styles.submitBtn} disabled>
          <Text style={styles.submitText}>Kirim pengajuan</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.hair,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  headerSub: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 3,
  },

  segment: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.chip,
    marginTop: 14,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
  },
  segBtnOn: {
    backgroundColor: colors.card,
    shadowColor: "#0F1720",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  segText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  segTextOn: { color: colors.ink },

  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
  placeholder: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 22,
    padding: 16,
  },
  placeholderText: { fontSize: 12.5, color: colors.muted },

  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.hair,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  sumSub: { fontSize: 10.5, fontWeight: "600", color: colors.muted },
  sumTop: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 3 },
  submitBtn: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.track,
  },
  submitText: { fontSize: 13.5, fontWeight: "700", color: colors.mutedLabel },
});
