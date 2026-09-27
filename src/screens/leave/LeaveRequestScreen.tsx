import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CutiTypeCard, CutiDetailCard, JenisCuti } from "./CutiFormCards";
import {
  LemburJamCard,
  LemburUraianCard,
  LemburBuktiCard,
  BuktiFile,
} from "./LemburFormCards";
import { jamMenit, durasiJam } from "@/utils/date";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveBalance } from "@/services/types";
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
  const { employee } = useSession();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [jenisCuti, setJenisCuti] = useState<JenisCuti>("Tahunan");
  const [alasan, setAlasan] = useState("");
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<FormKind>(route?.params?.kind ?? "cuti");
  const [otEndRaw, setOtEndRaw] = useState(0);
  const [uraian, setUraian] = useState("");
  const [otFiles, setOtFiles] = useState<BuktiFile[]>([]);

  const meta = FORM_META[kind];

  const isSingle = kind === "lembur";

  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [otDate, setOtDate] = useState<string | null>(null);

  const start = isSingle ? otDate : rangeStart;
  const end = isSingle ? otDate : rangeEnd;
  const range = start && end;

  const otHoliday = !!otDate && [0, 6].includes(fromISODate(otDate).getDay());
  const otStart = otHoliday ? 8 * 60 : 17 * 60;
  const otMax = otHoliday ? 8 * 60 : 4 * 60;
  const otEnd = Math.min(Math.max(otEndRaw, otStart + 60), otStart + otMax);
  const otJam = (otEnd - otStart) / 60;

  useEffect(() => {
    if (!employee) return;
    hrisApi.getLeaveBalances(employee.id).then(setBalances);
  }, [employee]);

  const saldo = balances.find((b) => b.type === "cuti")?.remaining ?? 0;
  const hariKerja = start && end ? hitungHariKerja(start, end) : 0;

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
        {
          label: "Durasi",
          value: otDate ? durasiJam(otJam) : "—",
          accent: true,
        },
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
          {kind === "cuti" && (
            <CutiTypeCard
              jenis={jenisCuti}
              onPick={setJenisCuti}
              saldo={saldo}
              hariKerja={hariKerja}
            />
          )}

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

          {kind === "cuti" && (
            <CutiDetailCard
              jenis={jenisCuti}
              alasan={alasan}
              onChangeAlasan={setAlasan}
            />
          )}

          {kind === "lembur" && (
            <>
              <LemburJamCard
                holiday={otHoliday}
                startLabel={jamMenit(otStart)}
                endLabel={jamMenit(otEnd)}
                rule={
                  otHoliday
                    ? "Hari libur · maks. 8 jam"
                    : "Hari kerja · mulai setelah jam pulang, maks. 4 jam"
                }
                onMinus={() => setOtEndRaw(otEnd - 30)}
                onPlus={() => setOtEndRaw(otEnd + 30)}
              />
              <LemburUraianCard uraian={uraian} onChange={setUraian} />
              <LemburBuktiCard
                files={otFiles}
                onAdd={() =>
                  setOtFiles((prev) => [
                    ...prev,
                    {
                      name: `bukti-lembur-${prev.length + 1}.jpg`,
                      size: "1,2 MB",
                    },
                  ])
                }
                onRemove={(i) =>
                  setOtFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sumSub}>
            {kind === "cuti" && start && end
              ? `${jenisCuti} · ${tanggalPendek(start)} – ${tanggalPendek(end)}`
              : "Belum lengkap"}
          </Text>
          <Text style={styles.sumTop}>
            {kind === "cuti" && hariKerja > 0
              ? `${hariKerja} hari kerja`
              : kind === "lembur" && otDate
                ? durasiJam(otJam)
                : "—"}
          </Text>
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
