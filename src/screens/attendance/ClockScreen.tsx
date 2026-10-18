import React, { useCallback, useState, useMemo } from "react";
import type { ScreenProps } from "@/navigation/types";
import { formatDuration, getAttendanceStatus } from "@/utils/statusPresensi";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Palette, secondaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { MapPreview } from "./MapPreview";
import { formatLongDate } from "@/utils/date";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { ClockState } from "@/services/types";
import { FaceCheck } from "./FaceCheck";
import { isFaceSupported } from "@/services/faceCheck";
import { Skeleton } from "@/components/Skeleton";
import { describeError } from "@/services/api/http";
import { ErrorState } from "@/components/ErrorState";
import { useT } from "@/i18n";
import { useWorkLocation } from "@/hooks/useLokasiKerja";
import { setTabBarHidden } from "@/navigation/tabBarVisibility";
import type { FaceStatus, SpoofSummary } from "@/services/types";
import { goBackOrHome, goHome } from "@/navigation/kembali";

export function ClockScreen({ navigation }: ScreenProps) {
  const t = useT();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ClockState | null>(null);
  const [step, setStep] = useState(0);
  // Aksi yang baru dilakukan; status clockedIn berbalik sesudah berhasil, jadi layar selesai memakai ini.
  const [completedAction, setCompletedAction] = useState<"IN" | "OUT" | null>(
    null,
  );
  const { permission, fix, nearest, geofenceRule, latestFetch } =
    useWorkLocation(step < 2); // 0 = GPS, 1 = wajah, 2 = selesai
  const [isLoading, setIsLoading] = useState(false);
  const [hasFacePassed, setHasFacePassed] = useState(false);
  const [faceStatus, setFaceStatus] = useState<FaceStatus | null>(null);
  const [faceVec, setFaceVec] = useState<number[] | null>(null);
  const [spoof, setSpoof] = useState<SpoofSummary | null>(null);
  const handleFacePassed = useCallback(
    (v: number[] | null, spoof?: SpoofSummary) => {
      setFaceVec(v);
      setSpoof(spoof ?? null);
      setHasFacePassed(true);
    },
    [],
  );
  // Perangkat tanpa modul wajah (iOS, Expo Go) melewati langkah ini.
  const isFaceOk = hasFacePassed || !isFaceSupported();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!employee) return;
    setLoadError(null);
    hrisApi
      .getClockState(employee.id)
      .then(setState)
      .catch((e) => setLoadError(describeError(e)));
    hrisApi
      .getFaceStatus()
      .then(setFaceStatus)
      .catch(() => setFaceStatus(null));
  }, [employee]);

  useFocusEffect(load);

  // Tab bar mengambang disembunyikan selama langkah verifikasi wajah.
  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(step === 1);
      return () => setTabBarHidden(false);
    }, [step]),
  );

  if (!employee) return null;

  // Layar ini sebelumnya return null selama memuat, jadi penggunanya melihat
  // halaman kosong tanpa penjelasan — padahal Presensi termasuk layar yang
  // paling sering dibuka.
  if (!state) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={styles.backBtn}
            onPress={() => goBackOrHome(navigation)}
          >
            <Ionicons name="chevron-back" size={18} color={c.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("ab.presensi")}</Text>
        </View>

        <View style={styles.content}>
          {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}
          {!loadError ? (
            <>
              <View style={styles.steps}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.stepBar, { backgroundColor: c.track }]}
                  />
                ))}
              </View>

              <View style={styles.panel}>
                <Skeleton width="100%" height={216} radius={0} />
                <View style={styles.locationRow}>
                  <Skeleton width={34} height={34} radius={11} />
                  <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                    <Skeleton width="72%" height={12} radius={4} />
                    <Skeleton width="54%" height={10} radius={4} />
                  </View>
                </View>
              </View>

              <Skeleton height={48} radius={16} style={{ marginTop: 12 }} />
            </>
          ) : null}
        </View>
      </View>
    );
  }

  const done = step === 2;
  const currentAction: "IN" | "OUT" = done
    ? (completedAction ?? "IN")
    : state.clockedIn
      ? "OUT"
      : "IN";
  const actionLabel =
    currentAction === "OUT" ? t("ab.clockOut") : t("ab.clockIn");

  // Clock In hanya di area kerja (kecuali jadwal WFH atau dinas luar, yang server
  // bebaskan); Clock Out bebas di mana saja. Server tetap yang memutuskan: ini
  // mencegah ketukan yang pasti ditolak dan menjelaskan alasannya.
  const isClockingIn = !state.clockedIn;
  const isWfh = geofenceRule?.wfhToday ?? false;
  let blockReason: string | null = null;
  if (
    isClockingIn &&
    !done &&
    geofenceRule &&
    geofenceRule.mode === "Block" &&
    !isWfh
  ) {
    if (permission === "ditolak") {
      blockReason = t("loc.tanpa");
    } else if (geofenceRule.locations.length > 0) {
      if (!fix) blockReason = t("loc.mencari");
      else if (fix.mocked) blockReason = t("loc.mock");
      else if (fix.accuracyM > geofenceRule.maxAccuracyM)
        blockReason = t("loc.akurasiBuruk", { m: Math.round(fix.accuracyM) });
      else if (nearest && !nearest.isInside)
        blockReason = t("loc.diluar", { m: nearest.distanceM });
    }
  }

  // Absen masuk mewajibkan wajah terdaftar dan disetujui HR (Face Settings > Require Registered Face).
  // Absen keluar tidak diblokir.
  const isFaceMissing =
    isClockingIn &&
    !done &&
    !!faceStatus?.requireEnrollment &&
    faceStatus.state !== "active" &&
    faceStatus.state !== "needs_reenroll";
  if (!blockReason && isFaceMissing) {
    blockReason = t(
      faceStatus?.state === "pending" ? "fe.blokMenunggu" : "fe.blokBelum",
    );
  }

  const handleNext = async () => {
    if (done) {
      goHome(navigation);
      return;
    }
    if (step === 0) {
      setStep(1);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const lokasi = await latestFetch();
      const performedAction: "IN" | "OUT" = state.clockedIn ? "OUT" : "IN";
      const next = state.clockedIn
        ? await hrisApi.clockOut(
            employee.id,
            lokasi,
            faceVec ?? undefined,
            spoof ?? undefined,
          )
        : await hrisApi.clockIn(
            employee.id,
            lokasi,
            faceVec ?? undefined,
            spoof ?? undefined,
          );
      setState(next);
      setCompletedAction(performedAction);
      setStep(2);
      setHasFacePassed(false);
      setFaceVec(null);
      setSpoof(null);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsLoading(false);
    }
  };

  const ctaCaption = done
    ? t("ab.selesai")
    : step === 0
      ? t("ab.lanjutWajah")
      : t("ab.konfirmasi", { aksi: actionLabel });

  const jam = currentAction === "IN" ? state.lastCheckIn : state.lastCheckOut;
  const result = getAttendanceStatus(currentAction, jam, state);
  const labelStatus = state.pendingOffline
    ? t("ab.menungguKirim")
    : result.kind === "terlambat"
      ? t("ab.terlambat", { durasi: formatDuration(result.minutes) })
      : result.kind === "pulangAwal"
        ? t("ab.pulangAwal", { durasi: formatDuration(result.minutes) })
        : t("ab.tepat");

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackOrHome(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("ab.presensi")}</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.onlinePill}>
          <Text style={styles.onlineText}>{t("ab.online")}</Text>
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

        {isFaceMissing && faceStatus?.state !== "pending" ? (
          <Pressable
            style={styles.faceBanner}
            onPress={() =>
              navigation.navigate("Profil", { screen: "FaceEnroll" })
            }
          >
            <Text style={styles.faceBannerText}>{t("fe.blokBelum")}</Text>
            <Text style={styles.faceBannerCta}>{t("fe.daftarSekarang")}</Text>
          </Pressable>
        ) : null}

        {state.pendingOffline && !done ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>{t("ab.offlineTersimpan")}</Text>
          </View>
        ) : null}

        {step === 0 && (
          <View style={styles.panel}>
            <MapPreview
              badge={
                nearest ? t("loc.radius", { m: nearest.radiusM }) : undefined
              }
              inside={nearest?.isInside}
            />
            <View style={styles.locationRow}>
              <View style={styles.locationIcon}>
                <Ionicons
                  name="location-outline"
                  size={24}
                  color={c.info.ink}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.locationName}>
                  {state.workLocation ?? t("ab.kantor")}
                </Text>
                <Text style={styles.locationCoord}>
                  {permission === "ditolak"
                    ? t("loc.izinDitolak")
                    : fix && nearest
                      ? t("loc.jarak", {
                          m: nearest.distanceM,
                          lokasi: nearest.nama,
                          acc: Math.round(fix.accuracyM),
                        })
                      : fix
                        ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`
                        : t("loc.mencari")}
                </Text>
                {isWfh ? (
                  <Text
                    style={[
                      styles.locationCoord,
                      { color: c.ok.ink, fontWeight: "700" },
                    ]}
                  >
                    {t("loc.wfh")}
                  </Text>
                ) : !isClockingIn ? (
                  <Text style={styles.locationCoord}>
                    {t("loc.keluarBebas")}
                  </Text>
                ) : blockReason ? (
                  <Text
                    style={[
                      styles.locationCoord,
                      {
                        color: fix?.mocked ? c.bad.ink : c.warn.ink,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {blockReason}
                  </Text>
                ) : fix && nearest ? (
                  <Text
                    style={[
                      styles.locationCoord,
                      { color: c.ok.ink, fontWeight: "700" },
                    ]}
                  >
                    {t("loc.didalam")}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={[styles.panel, styles.facePanel]}>
            <Text style={styles.faceTitle}>{t("ab.faceTitle")}</Text>
            <Text style={styles.faceSub}>{t("ab.faceSub")}</Text>
            {isFaceSupported() ? (
              <FaceCheck
                onPass={handleFacePassed}
                action={state.clockedIn ? "OUT" : "IN"}
              />
            ) : (
              <Text style={styles.faceSub}>{t("face.tidakDidukung")}</Text>
            )}
            {isFaceOk && isFaceSupported() ? (
              <View style={styles.faceChips}>
                <View style={[styles.faceChip, { backgroundColor: c.ok.bg }]}>
                  <Text style={[styles.faceChipText, { color: c.ok.ink }]}>
                    {t("face.chipLiveness")}
                  </Text>
                </View>
              </View>
            ) : null}
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
              <Text style={styles.doneTitle}>
                {t(
                  state.pendingOffline ? "ab.berhasilOffline" : "ab.berhasil",
                  {
                    actionLabel,
                  },
                )}
              </Text>
              <Text style={styles.doneSub}>
                {formatLongDate()} · {jam ?? "--:--"}{" "}
                {state.timezoneLabel ?? "WIB"}
              </Text>

              <View style={styles.doneMeta}>
                <DoneMeta label={t("ab.metode")} value="Face + GPS" />
                <DoneMeta label={t("ab.status")} value={labelStatus} />
                <DoneMeta
                  label={t("ab.shift")}
                  value={state.shiftName ?? t("ab.reguler")}
                />
              </View>
            </LinearGradient>

            <View style={styles.syncCard}>
              <Text style={styles.syncLabel}>{t("ab.tersinkron")}</Text>
              <Text style={styles.syncValue}>
                {state.pendingOffline
                  ? t("ab.tersimpanOffline")
                  : "Employee Checkin"}
              </Text>
            </View>
          </>
        )}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.cta,
              {
                backgroundColor: done
                  ? c.ok.ink
                  : blockReason || (step === 1 && !isFaceOk)
                    ? c.track
                    : c.accent,
              },
            ]}
            onPress={handleNext}
            disabled={isLoading || !!blockReason || (step === 1 && !isFaceOk)}
          >
            <Text style={styles.ctaText}>
              {isLoading ? t("umum.memproses") : ctaCaption}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate("History")}
          >
            <Text style={styles.secondaryText}>{t("ab.riwayat")}</Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate("AttendanceCorrection")}
          >
            <Text style={styles.secondaryText}>{t("ab.koreksi")}</Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate("AttendanceCorrectionHistory")}
          >
            <Text style={styles.secondaryText}>{t("ab.riwayatKoreksi")}</Text>
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
    <View style={styles.doneMetaItem}>
      <Text style={styles.doneMetaLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.doneMetaValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    faceBanner: {
      backgroundColor: c.warn.bg,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      gap: 6,
    },
    faceBannerText: { fontSize: 12.5, fontWeight: "700", color: c.warn.ink },
    faceBannerCta: { fontSize: 12, fontWeight: "800", color: c.accent },
    offlineBanner: {
      marginBottom: 12,
      padding: 13,
      borderRadius: 16,
      backgroundColor: c.warn.bg,
    },
    offlineText: { fontSize: 12, fontWeight: "700", color: c.warn.ink },
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

    content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 160 },
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
      backgroundColor: "transparent",
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
      backgroundColor: c.onDark.pill,
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
      color: c.onDark.ink,
      marginTop: 5,
    },
    doneMetaItem: { flex: 1, minWidth: 0 },
    doneMeta: {
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
      alignSelf: "stretch",
      marginTop: 16,
      backgroundColor: c.onDark.track,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    doneMetaLabel: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.onDark.soft,
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
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
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
      ...secondaryButtonStyle(c),
      alignItems: "center",
    },
    secondaryText: { fontSize: 13, fontWeight: "600", color: c.btnSoftInk },
    errorText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: c.bad.ink,
      textAlign: "center",
      marginBottom: 10,
    },
  });
