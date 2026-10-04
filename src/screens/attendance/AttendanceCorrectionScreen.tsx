import { useEffect, useState, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gabungAlasan } from "@/utils/Correction";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { AttendanceRecord } from "@/services/types";
import { ATTENDANCE_STATUS_LABEL } from "@/constants/statusLabels";
import { DatePickerCard } from "@/components/DatePickerCard";
import {
  ApprovalFlowCard,
  ApprovalStep,
  FormDoneView,
} from "@/screens/leave/FormFlowCards";
import { BuktiFile } from "@/screens/leave/LemburFormCards";
import {
  AlasanKoreksiCard,
  BuktiKoreksiCard,
  JamAjuanCard,
  JenisKoreksi,
  TercatatCard,
} from "./KoreksiCards";
import {
  durasiJam,
  jamMenit,
  menitDari,
  namaHari,
  tanggalPendek,
} from "@/utils/date";

const APPROVERS: ApprovalStep[] = [
  { ini: "BP", name: "Bayu Pratama", role: "Atasan langsung" },
  { ini: "DL", name: "Dinda Larasati", role: "HR Admin" },
];

export function AttendanceCorrectionScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [tanggal, setTanggal] = useState<string | null>(null);
  const [masuk, setMasukRaw] = useState(8 * 60);
  const [keluar, setKeluarRaw] = useState(17 * 60);
  const [jenis, setJenis] = useState<JenisKoreksi>("Lupa absen masuk");
  const [alasan, setAlasan] = useState("");
  const [files, setFiles] = useState<BuktiFile[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getAttendanceHistory(employee.id).then(setHistory);
  }, [employee]);

  const record = tanggal
    ? (history.find((r) => r.date === tanggal) ?? null)
    : null;

  // Tiap ganti tanggal, isi ulang jam dari log yang tercatat kalau ada.
  useEffect(() => {
    if (!tanggal) return;
    const r = history.find((x) => x.date === tanggal);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- sengaja: isi ulang jam saat tanggal berganti
    setMasukRaw(r?.checkIn ? menitDari(r.checkIn) : 8 * 60);
    setKeluarRaw(r?.checkOut ? menitDari(r.checkOut) : 17 * 60);
  }, [tanggal, history]);

  // Clamp di setter: dua nilai ini independen, hubungannya diurus validasi.
  const setMasuk = (v: number) =>
    setMasukRaw(Math.min(Math.max(v, 5 * 60), 12 * 60));
  const setKeluar = (v: number) =>
    setKeluarRaw(Math.min(Math.max(v, 6 * 60), 23 * 60 + 45));

  const buktiWajib = !!tanggal && !record;

  const blockMsg = !tanggal
    ? "Tanggal belum dipilih"
    : keluar < masuk + 60
      ? "Jam keluar minimal 1 jam setelah masuk"
      : alasan.trim().length < 15
        ? "Penjelasan minimal 15 karakter"
        : buktiWajib && files.length === 0
          ? "Tidak ada log absensi, bukti wajib dilampirkan"
          : "";

  const bisaKirim = !blockMsg && !sending;

  const footer = tanggal
    ? [
        {
          label: "Tanggal",
          value: `${namaHari(tanggal)}, ${tanggalPendek(tanggal)}`,
        },
        {
          label: "Log tercatat",
          value: record ? ATTENDANCE_STATUS_LABEL[record.status] : "Tidak ada",
          accent: !record,
        },
      ]
    : [
        { label: "Tanggal", value: "Belum dipilih" },
        { label: "Log tercatat", value: "—" },
      ];

  const buatDoneRows = () => {
    if (!tanggal) return [];
    return [
      { k: "Tanggal", v: `${namaHari(tanggal)}, ${tanggalPendek(tanggal)}` },
      { k: "Jam diajukan", v: `${jamMenit(masuk)} – ${jamMenit(keluar)}` },
      { k: "Jenis", v: jenis },
      { k: "Bukti", v: `${files.length} file` },
    ];
  };

  const handleSubmit = async () => {
    if (!employee || !tanggal || !bisaKirim) return;
    setSending(true);
    try {
      const res = await hrisApi.submitAttendanceCorrection({
        employeeId: employee.id,
        date: tanggal,
        requestedCheckIn: jamMenit(masuk),
        requestedCheckOut: jamMenit(keluar),
        reason: gabungAlasan(jenis, alasan),
      });
      setDone(res.id);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={c.ink} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle}>Koreksi Absensi</Text>
            <Text style={styles.headerSub}>Attendance Request</Text>
          </View>
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
          {done ? (
            <FormDoneView
              title="Koreksi absensi terkirim"
              waitingOn={APPROVERS[0].name}
              rows={buatDoneRows()}
              doc={`Attendance Request · HR-ATR-${done}`}
              onLihat={() => navigation.navigate("AttendanceCorrectionHistory")}
              onHome={() => navigation.getParent()?.navigate("Beranda")}
            />
          ) : (
            <>
              <DatePickerCard
                mode="single"
                allow="past"
                title="Tanggal yang dikoreksi"
                hint="Hanya tanggal yang sudah berjalan"
                start={tanggal}
                end={tanggal}
                onChange={(s) => setTanggal(s)}
                footer={footer}
              />

              {tanggal && <TercatatCard record={record} />}

              <JamAjuanCard
                masuk={masuk}
                keluar={keluar}
                onChangeMasuk={setMasuk}
                onChangeKeluar={setKeluar}
              />

              <AlasanKoreksiCard
                jenis={jenis}
                onPickJenis={setJenis}
                alasan={alasan}
                onChangeAlasan={setAlasan}
              />

              <BuktiKoreksiCard
                files={files}
                wajib={buktiWajib}
                onAdd={() =>
                  setFiles((prev) => [
                    ...prev,
                    {
                      name: `bukti-koreksi-${prev.length + 1}.jpg`,
                      size: "0,9 MB",
                    },
                  ])
                }
                onRemove={(i) =>
                  setFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
              />

              <ApprovalFlowCard steps={APPROVERS} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {!done && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.sumSub, blockMsg ? { color: c.bad.ink } : null]}
            >
              {blockMsg || "Siap dikirim"}
            </Text>
            <Text style={styles.sumTop}>
              {tanggal && keluar > masuk
                ? durasiJam((keluar - masuk) / 60)
                : "—"}
            </Text>
          </View>
          <Pressable onPress={handleSubmit} disabled={!bisaKirim}>
            <LinearGradient
              colors={bisaKirim ? [c.accent, c.accent2] : [c.track, c.track]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitBtn}
            >
              <Text
                style={[
                  styles.submitText,
                  bisaKirim ? { color: "#fff" } : null,
                ]}
              >
                {sending ? "Mengirim..." : "Kirim koreksi"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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
      fontSize: 10.5,
      fontWeight: "600",
      color: c.muted,
      marginTop: 3,
    },

    content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24 },

    actionBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.hair,
      paddingHorizontal: 18,
      paddingTop: 12,
    },
    sumSub: { fontSize: 10.5, fontWeight: "600", color: c.muted },
    sumTop: {
      fontSize: 16,
      fontWeight: "800",
      color: c.ink,
      marginTop: 3,
    },
    submitBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16 },
    submitText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
