import React, { useEffect, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { MapPreview } from "./MapPreview";
import { formatTanggalPanjang } from "@/utils/date";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { ClockState } from "@/services/types";
import { FaceViewfinder } from "./FaceViewfinder";

export function ClockScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ClockState | null>(null);
  const [step, setStep] = useState(0); // 0 = GPS, 1 = wajah, 2 = selesai
  const [loading, setLoading] = useState(false);
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getClockState(employee.id).then(setState);
  }, [employee]);

  if (!employee || !state) return null;

  const aksi = state.clockedIn ? "Clock Out" : "Clock In";
  const done = step === 2;

  const handleNext = async () => {
    if (done) {
      navigation.getParent()?.navigate("Beranda");
      return;
    }
    if (step === 0) {
      setStep(1);
      return;
    }
    setLoading(true);
    try {
      const next = state.clockedIn
        ? await hrisApi.clockOut(employee.id)
        : await hrisApi.clockIn(employee.id);
      setState(next);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const ctaLabel = done
    ? "Selesai, ke Beranda"
    : step === 0
      ? "Lanjut verifikasi wajah"
      : `Konfirmasi ${aksi}`;

  const jam = state.clockedIn ? state.lastCheckIn : state.lastCheckOut;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.getParent()?.navigate("Beranda")}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Presensi</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.onlinePill}>
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.steps}>
          <View style={[styles.stepBar, { backgroundColor: c.accent }]} />
          <View
            style={[
              styles.stepBar,
              { backgroundColor: step >= 1 ? c.accent : c.track },
            ]}
          />
          <View
            style={[
              styles.stepBar,
              { backgroundColor: done ? c.accent : c.track },
            ]}
          />
        </View>

        {step === 0 && (
          <View style={styles.panel}>
            <MapPreview />
            <View style={styles.locationRow}>
              <View style={styles.locationIcon}>
                <LineIcon d={ICON.location} color={c.info.ink} size={16} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.locationName}>
                  Kantor Pusat — Jl. Gatot Subroto 42
                </Text>
                <Text style={styles.locationCoord}>
                  -6.23412, 106.81674 · akurasi 8 m
                </Text>
              </View>
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={[styles.panel, styles.facePanel]}>
            <Text style={styles.faceTitle}>Face Recognition</Text>
            <Text style={styles.faceSub}>
              Posisikan wajah di dalam bingkai, lepas masker dan kacamata gelap
            </Text>
            <FaceViewfinder />
            <View style={styles.faceChips}>
              <View style={[styles.faceChip, { backgroundColor: c.ok.bg }]}>
                <Text style={[styles.faceChipText, { color: c.ok.ink }]}>
                  Liveness ✓
                </Text>
              </View>
              <View style={[styles.faceChip, { backgroundColor: c.info.bg }]}>
                <Text style={[styles.faceChipText, { color: c.info.ink }]}>
                  Match 98,4%
                </Text>
              </View>
            </View>
          </View>
        )}

        {done && (
          <>
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.doneCard}
            >
              <View style={styles.doneCheck}>
                <Ionicons name="checkmark" size={30} color="#fff" />
              </View>
              <Text style={styles.doneTitle}>{aksi} berhasil</Text>
              <Text style={styles.doneSub}>
                {formatTanggalPanjang()} · {jam ?? "--:--"} WIB
              </Text>

              <View style={styles.doneMeta}>
                <DoneMeta label="Metode" value="Face + GPS" />
                <DoneMeta label="Status" value="Tepat waktu" />
                <DoneMeta label="Shift" value="Reguler" />
              </View>
            </LinearGradient>

            <View style={styles.syncCard}>
              <Text style={styles.syncLabel}>Tersinkron ke ERPNext</Text>
              <Text style={styles.syncValue}>
                Employee Checkin · ECKIN-2026-08841
              </Text>
            </View>
          </>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[
              styles.cta,
              { backgroundColor: done ? c.ok.ink : c.accent },
            ]}
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.ctaText}>
              {loading ? "Memproses..." : ctaLabel}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate("History")}
          >
            <Text style={styles.secondaryText}>Lihat riwayat absensi</Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate("AttendanceCorrection")}
          >
            <Text style={styles.secondaryText}>Ajukan koreksi absensi</Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate("AttendanceCorrectionHistory")}
          >
            <Text style={styles.secondaryText}>Riwayat koreksi</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function DoneMeta({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View>
      <Text style={styles.doneMetaLabel}>{label}</Text>
      <Text style={styles.doneMetaValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.ink },
    onlinePill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: c.ok.bg,
    },
    onlineText: { fontSize: 10.5, fontWeight: "600", color: c.ok.ink },

    content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 120 },
    steps: { flexDirection: "row", gap: 7, marginBottom: 14 },
    stepBar: { flex: 1, height: 3, borderRadius: 2 },

    panel: {
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    locationIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    locationName: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    locationCoord: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    facePanel: { padding: 18, alignItems: "center" },
    faceTitle: { fontSize: 14, fontWeight: "700", color: c.ink },
    faceSub: {
      fontSize: 11.5,
      lineHeight: 17,
      fontWeight: "500",
      color: c.muted,
      marginTop: 5,
      textAlign: "center",
      maxWidth: 250,
    },
    faceChips: { flexDirection: "row", gap: 8, marginTop: 14 },
    faceChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
    faceChipText: { fontSize: 10.5, fontWeight: "600" },

    doneCard: {
      borderRadius: 22,
      paddingHorizontal: 20,
      paddingVertical: 26,
      alignItems: "center",
    },
    doneCheck: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    doneTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: "#fff",
      marginTop: 14,
    },
    doneSub: {
      fontSize: 13,
      fontWeight: "600",
      color: "rgba(255,255,255,0.8)",
      marginTop: 5,
    },
    doneMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignSelf: "stretch",
      marginTop: 16,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    doneMetaLabel: {
      fontSize: 10.5,
      fontWeight: "500",
      color: "rgba(255,255,255,0.75)",
    },
    doneMetaValue: {
      fontSize: 12.5,
      fontWeight: "700",
      color: "#fff",
      marginTop: 3,
    },

    syncCard: {
      marginTop: 12,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.panelBorder,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    syncLabel: { fontSize: 11.5, fontWeight: "600", color: c.muted },
    syncValue: {
      fontSize: 11,
      fontWeight: "600",
      color: c.info.ink,
      marginTop: 6,
    },

    actions: { marginTop: 14, gap: 9 },
    cta: {
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: "center",
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 22,
      elevation: 5,
    },
    ctaText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
    secondary: {
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: c.chip,
      alignItems: "center",
    },
    secondaryText: { fontSize: 13, fontWeight: "600", color: c.ink },
  });
