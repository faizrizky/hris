import { TourTarget } from "@/components/TourTarget";
import { useMemo } from "react";
import type { ScreenProps } from "@/navigation/types";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { CameraView } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";
import { EmptyState } from "@/components/EmptyState";
import { isFaceSupported } from "@/services/faceCheck";
import { FaceRing } from "./FaceRing";
import { SamsungRing, TICKS } from "./SamsungRing";
import { useFaceEnroll } from "@/hooks/useFaceEnroll";

// Sudut kepala (derajat) yang dianggap "sampai" ke tepi lingkaran. Mendongak/menunduk lebih sulit
// daripada menoleh, jadi ambangnya lebih kecil; arah diagonal memakai kombinasi keduanya (elips).
// Liveness saat pendaftaran: setelah cincin penuh, dua perintah dengan urutan acak yang baru muncul saat itu
// (pejamkan mata, lalu/atau toleh ke samping). Foto atau video rekaman tidak tahu kapan dan apa perintahnya.
// Kamera hanya beberapa frame per detik, jadi gerakannya dipilih yang bertahan lama (pejam, bukan kedip
// sekejap) dan arah toleh bebas supaya tidak gagal karena salah sisi.
const CHALLENGE_COUNT = 2;
// Anti-spoofing (Minivision): dari foto kualitas tinggi saat menghadap depan. Foto/video di layar menghasilkan skor
// rendah di sebagian besar frame, jadi keputusan memakai median beberapa frame, bukan satu frame.
// Warna layar Face ID: selalu gelap, apa pun tema aplikasinya.
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const DIM = "rgba(255,255,255,0.62)";
const BLUE = "#0A84FF";
// Pendaftaran wajah meniru alur Face ID: panduan, posisikan wajah di bingkai,
// kamera mengecil menjadi lingkaran, spin kepala sampai cincin hijau penuh,
// lalu "Pemindaian wajah selesai".
export function FaceEnrollScreen({ navigation }: ScreenProps) {
  const {
    cameraRef,
    status,
    phase,
    photoSize,
    prepareCamera,
    filledTickList,
    statusMessage,
    errorMessage,
    hasFace,
    challenge,
    warning,
    spin,
    masuk,
    submit,
    isActive,
    mulai,
    cancelScan,
  } = useFaceEnroll();
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Resolusi foto kecil (sekitar 640 px) membuat ambil foto + deteksi jauh lebih cepat; wajah tetap cukup
  // besar untuk embedding 112x112.
  // Dipanggil dari dalam loop kamera: membaca `t` terbaru tanpa memulai ulang loop.
  // Embedding KTP dan foto profil dihitung SEBELUM pemindaian, supaya foto yang tidak berisi wajah
  // ketahuan sebelum karyawan memutar kepala.
  // Animasi: cincin panduan di layar pembuka berputar; pemindaian memakai lingkaran gaya Samsung.
  // Pemindaian: frame berkala, baca sudut kepala, nyalakan garis cincin, simpan embedding per sektor.
  const lightHeader = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable
        style={styles.backBtn}
        onPress={() => goBackAnimated(navigation)}
      >
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>{t("fe.judul")}</Text>
    </View>
  );

  if (!isFaceSupported()) {
    return (
      <View style={styles.container}>
        {lightHeader}
        <EmptyState
          title={t("fe.tidakDidukung")}
          text={t("face.tidakDidukung")}
        />
      </View>
    );
  }

  if (phase === "muat") {
    return <View style={[styles.container, { backgroundColor: BLACK }]} />;
  }

  const hasMissingRequirement =
    status && (!status.ktpUrl || !status.profileUrl);
  if (hasMissingRequirement && status) {
    const isIdCardMissing = !status.ktpUrl;
    return (
      <View style={styles.container}>
        {lightHeader}
        <TourTarget id="p.wajahMulai">
          <EmptyState
            title={t(isIdCardMissing ? "fe.butuhKtp" : "fe.butuhFoto")}
            text={t(isIdCardMissing ? "fe.butuhKtpPesan" : "fe.butuhFotoPesan")}
          >
            <Pressable
              style={styles.lightButton}
              onPress={() =>
                navigation.navigate(
                  isIdCardMissing ? "ProfileDocs" : "ProfilePhoto",
                )
              }
            >
              <Text style={styles.lightButtonText}>
                {t(isIdCardMissing ? "fe.keDokumen" : "fe.keFoto")}
              </Text>
            </Pressable>
          </EmptyState>
        </TourTarget>
      </View>
    );
  }

  if (phase === "selesai" || status?.state === "pending") {
    return (
      <View style={styles.container}>
        {lightHeader}
        <TourTarget id="p.wajahMulai">
          <EmptyState
            icon="M5 13l4 4L19 7"
            title={t("fe.menunggu")}
            text={t("fe.menungguPesan")}
          />
        </TourTarget>
      </View>
    );
  }

  // ---- Layar gelap ala Face ID ----
  const D = Math.min(W * 0.66, 270); // diameter lingkaran kamera
  const aboveRing = insets.top + 96;
  const reveal = {
    opacity: masuk,
    transform: [
      {
        translateY: masuk.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };
  const isCameraVisible =
    phase === "posisi" ||
    phase === "pindai" ||
    phase === "lengkap" ||
    phase === "kirim";
  const percent =
    phase === "lengkap" || phase === "kirim"
      ? 100
      : Math.min(100, Math.round((filledTickList.length / TICKS) * 100));
  const bottomTextTop = aboveRing + D + 62;

  return (
    <View style={[styles.container, { backgroundColor: BLACK }]}>
      <StatusBar style="light" />

      {isCameraVisible ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: (W - (D + 80)) / 2,
            top: aboveRing - 40,
            opacity: masuk,
          }}
        >
          <SamsungRing
            D={D}
            filledTicks={filledTickList}
            isFinished={phase === "lengkap" || phase === "kirim"}
            hasFace={hasFace || phase === "lengkap" || phase === "kirim"}
          >
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              animateShutter={false}
              pictureSize={photoSize}
              onCameraReady={prepareCamera}
            />
          </SamsungRing>
        </Animated.View>
      ) : null}

      {phase === "intro" || phase === "cek" ? (
        <Animated.View
          style={[
            styles.introWrapper,
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 },
            reveal,
          ]}
        >
          <View style={styles.introIcon}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    {
                      rotate: spin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                },
              ]}
            >
              <FaceRing size={200} rIn={70} filledTicks={[]} photoRadius={60} />
            </Animated.View>
            <Ionicons name="happy-outline" size={78} color={WHITE} />
          </View>
          {phase === "cek" ? null : (
            <Text style={styles.introTitle}>{t("fe.introJudul")}</Text>
          )}
          {phase === "cek" ? (
            <View style={styles.checkInfo}>
              <ActivityIndicator color={WHITE} />
              <Text style={styles.introBody}>{t("fe.memeriksa")}</Text>
            </View>
          ) : (
            <Text style={styles.introBody}>{t("fe.introIsi")}</Text>
          )}
          {status?.state === "active" ? (
            <Text style={styles.introStatus}>{t("fe.sudahAktif")}</Text>
          ) : status?.state === "needs_reenroll" ? (
            <Text style={[styles.introStatus, { color: "#FFD60A" }]}>
              {t("fe.perluDaftarUlang", { tgl: status.graceUntil ?? "-" })}
            </Text>
          ) : status?.state === "rejected" ? (
            <Text style={[styles.introStatus, { color: "#FF6961" }]}>
              {t("fe.ditolak", { alasan: status.note ?? "-" })}
            </Text>
          ) : null}
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
          <View style={{ flex: 1 }} />
          {phase === "cek" ? null : (
            <TourTarget id="p.wajahMulai" style={styles.stretch}>
              <Pressable style={styles.blueButton} onPress={mulai}>
                <Text style={styles.blueButtonText}>
                  {t(
                    status?.state === "active" ||
                      status?.state === "needs_reenroll"
                      ? "fe.daftarUlang"
                      : "fe.mulaiSingkat",
                  )}
                </Text>
              </Pressable>
            </TourTarget>
          )}
        </Animated.View>
      ) : (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.bottomText,
            { top: bottomTextTop, paddingBottom: insets.bottom + 24 },
            reveal,
          ]}
        >
          <Text style={styles.percent}>{percent}%</Text>
          <Text style={styles.instruction}>
            {phase === "posisi"
              ? t("fe.posisi")
              : phase === "pindai"
                ? t("fe.lingkarFaceId")
                : t("fe.lengkap")}
          </Text>
          {statusMessage && isActive ? (
            <Text style={styles.hint}>{statusMessage}</Text>
          ) : null}
          {warning && phase === "pindai" ? (
            <Text style={styles.warning}>{warning}</Text>
          ) : null}
          {phase === "pindai" && challenge ? (
            <Text style={styles.command}>
              {t(challenge.kind === "pejam" ? "fe.tantPejam" : "fe.tantToleh")}
              {` (${challenge.to}/${CHALLENGE_COUNT})`}
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          {phase === "lengkap" || phase === "kirim" ? (
            <Pressable
              style={[styles.blueButton, phase === "kirim" && { opacity: 0.6 }]}
              onPress={submit}
              disabled={phase === "kirim"}
            >
              {phase === "kirim" ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.blueButtonText}>{t("fe.lanjutkan")}</Text>
              )}
            </Pressable>
          ) : null}
        </Animated.View>
      )}

      <Pressable
        style={[styles.cancel, { top: insets.top + 12 }]}
        onPress={() =>
          phase === "intro" || phase === "cek"
            ? goBackAnimated(navigation)
            : cancelScan()
        }
        hitSlop={10}
      >
        <Text style={styles.cancelText}>{t("fe.batal")}</Text>
      </Pressable>
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
      paddingBottom: 16,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
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
    lightButton: {
      marginTop: 16,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    lightButtonText: { fontSize: 13, fontWeight: "700", color: "#fff" },

    cancel: { position: "absolute", left: 20 },
    cancelText: { fontSize: 16, fontWeight: "500", color: BLUE },

    stretch: { alignSelf: "stretch" },
    introWrapper: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 32,
    },
    introIcon: {
      width: 200,
      height: 200,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 40,
    },
    introTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: WHITE,
      textAlign: "center",
      marginTop: 40,
    },
    introBody: {
      fontSize: 14.5,
      lineHeight: 21,
      color: WHITE,
      textAlign: "center",
      marginTop: 10,
      maxWidth: 320,
    },
    introStatus: {
      fontSize: 13,
      lineHeight: 19,
      color: "#30D158",
      textAlign: "center",
      marginTop: 14,
      maxWidth: 320,
    },
    errorText: {
      fontSize: 13,
      lineHeight: 19,
      color: "#FF6961",
      textAlign: "center",
      marginTop: 14,
      maxWidth: 320,
    },
    blueButton: {
      ...primaryButtonStyle(c),
      alignSelf: "stretch",
      height: 52,
      borderRadius: 14,
      backgroundColor: BLUE,
      alignItems: "center",
      justifyContent: "center",
    },
    blueButtonText: { fontSize: 16, fontWeight: "600", color: WHITE },
    checkInfo: { alignItems: "center", gap: 12, marginTop: 20 },
    checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },

    bottomText: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      paddingHorizontal: 32,
    },
    command: {
      color: WHITE,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 8,
    },
    warning: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
      color: "#FFD60A",
      textAlign: "center",
      marginTop: 10,
      maxWidth: 300,
    },
    percent: {
      fontSize: 34,
      fontWeight: "400",
      color: WHITE,
      textAlign: "center",
      marginBottom: 6,
    },
    instruction: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "600",
      color: WHITE,
      textAlign: "center",
      maxWidth: 300,
    },
    hint: {
      fontSize: 13,
      color: DIM,
      textAlign: "center",
      marginTop: 8,
    },
  });
