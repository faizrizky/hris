import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEnrollAnimations } from "@/hooks/useEnrollAnimations";
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
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import type { Kunci } from "@/i18n/id";
import { goBackAnimated } from "@/navigation/navigationBack";
import { setTabBarHidden } from "@/navigation/tabBarVisibility";
import { EmptyState } from "@/components/EmptyState";
import { saveAttachment } from "@/utils/attachment";
import {
  detectFace,
  getFaceEmbedding,
  getSpoofScore,
  isSpoofAvailable,
  isFaceSupported,
} from "@/services/faceCheck";
import type { FaceStatus, SpoofSummary } from "@/services/types";
import { FaceRing } from "./FaceRing";
import { SamsungRing, TICKS } from "./SamsungRing";

// Sudut kepala (derajat) yang dianggap "sampai" ke tepi lingkaran. Mendongak/menunduk lebih sulit
// daripada menoleh, jadi ambangnya lebih kecil; arah diagonal memakai kombinasi keduanya (elips).
const YAW_MIN = 11;
const PITCH_MIN = 7;
const ENOUGH = Math.round(TICKS * 0.92); // sisa celah kecil diisi otomatis
// Liveness saat pendaftaran: setelah cincin penuh, dua perintah dengan urutan acak yang baru muncul saat itu
// (pejamkan mata, lalu/atau toleh ke samping). Foto atau video rekaman tidak tahu kapan dan apa perintahnya.
// Kamera hanya beberapa frame per detik, jadi gerakannya dipilih yang bertahan lama (pejam, bukan kedip
// sekejap) dan arah toleh bebas supaya tidak gagal karena salah sisi.
type Challenge = "pejam" | "toleh";
const CHALLENGE_COUNT = 2;
const HINT_MS = 8_000; // perintah belum terpenuhi selama ini: tampilkan petunjuk (tanpa mengulang)
const COMMAND_TIMEOUT_MS = 60_000; // waktu tambahan untuk perintah, terpisah dari waktu memutar cincin
const shuffleChallenges = (): Challenge[] =>
  Math.random() < 0.5 ? ["pejam", "toleh"] : ["toleh", "pejam"];
const SAMPLE_MIN = 3; // sampel wajah menghadap depan (kualitas tinggi) yang dibutuhkan sebelum selesai
const SAMPLE_MAX = 6;
// Anti-spoofing (Minivision): dari foto kualitas tinggi saat menghadap depan. Foto/video di layar menghasilkan skor
// rendah di sebagian besar frame, jadi keputusan memakai median beberapa frame, bukan satu frame.
const SPOOF_MIN_SAMPLES = 4;
const SPOOF_THRESHOLD = 0.5;
const SPOOF_WINDOW = 8;
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const SAMPLE_GAP_MS = 1200;
const SAMPLE_QUALITY = 0.7; // frame deteksi 0.25 cukup untuk posisi, tapi embedding butuh gambar lebih tajam
const TIME_LIMIT_MS = 90_000;

// Warna layar Face ID: selalu gelap, apa pun tema aplikasinya.
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const DIM = "rgba(255,255,255,0.62)";
const BLUE = "#0A84FF";

type Phase =
  | "muat"
  | "intro"
  | "cek"
  | "posisi"
  | "pindai"
  | "lengkap"
  | "kirim"
  | "selesai";

// Pendaftaran wajah meniru alur Face ID: panduan, posisikan wajah di bingkai,
// kamera mengecil menjadi lingkaran, spin kepala sampai cincin hijau penuh,
// lalu "Pemindaian wajah selesai".
export function FaceEnrollScreen({ navigation }: ScreenProps) {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("muat");
  const [isCameraReady, setIsCameraReady] = useState(false);
  // Resolusi foto kecil (sekitar 640 px) membuat ambil foto + deteksi jauh lebih cepat; wajah tetap cukup
  // besar untuk embedding 112x112.
  const [photoSize, setPhotoSize] = useState<string | undefined>(undefined);
  const prepareCamera = async () => {
    try {
      const list =
        (await cameraRef.current?.getAvailablePictureSizesAsync()) ?? [];
      const width = (u: string) => {
        const [a, b] = u.split("x").map(Number);
        return Math.min(a || 0, b || 0);
      };
      const pick = list
        .filter((u) => /^\d+x\d+$/.test(u) && width(u) >= 480)
        .sort((a, b) => width(a) - width(b))[0];
      if (pick) setPhotoSize(pick);
    } catch {
      // pakai ukuran bawaan
    }
    setIsCameraReady(true);
  };
  const [filledTickList, setFilledTicks] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [hasFace, setHasFace] = useState(false);
  const [challenge, setChallenge] = useState<{
    kind: Challenge;
    to: number;
  } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  // Dipanggil dari dalam loop kamera: membaca `t` terbaru tanpa memulai ulang loop.
  const showError = useEffectEvent((cacheKey: Kunci) =>
    setErrorMessage(t(cacheKey)),
  );
  const showMessage = useEffectEvent((cacheKey: Kunci) =>
    setStatusMessage(t(cacheKey)),
  );
  const showWarning = useEffectEvent((cacheKey: Kunci) =>
    setWarning(t(cacheKey)),
  );
  const [scanRound, setScanRound] = useState(0);
  // Embedding KTP dan foto profil dihitung SEBELUM pemindaian, supaya foto yang tidak berisi wajah
  // ketahuan sebelum karyawan memutar kepala.
  const acuan = useRef<{ ktp: number[]; prof: number[] } | null>(null);
  const embeddingSamples = useRef<number[][]>([]);
  const spoofResult = useRef<SpoofSummary | undefined>(undefined);

  // Animasi: cincin panduan di layar pembuka berputar; pemindaian memakai lingkaran gaya Samsung.
  const [pulse] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [masuk] = useState(() => new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(true);
      return () => setTabBarHidden(false);
    }, []),
  );

  useEffect(() => {
    hrisApi
      .getFaceStatus()
      .then((s) => {
        setStatus(s);
        setPhase("intro");
      })
      .catch((e) => {
        setErrorMessage(describeError(e));
        setPhase("intro");
      });
  }, []);

  useEnrollAnimations({ spin, pulse, masuk }, phase);

  const submit = async () => {
    setPhase("kirim");
    try {
      if (!acuan.current) throw new Error("syarat");
      await hrisApi.submitFaceEnrollment({
        embeddings: embeddingSamples.current,
        ktpEmbedding: acuan.current.ktp,
        profileEmbedding: acuan.current.prof,
        selfie: selfieUri
          ? { uri: selfieUri, name: "selfie.jpg", mimeType: "image/jpeg" }
          : undefined,
        spoof: spoofResult.current,
      });
      setPhase("selesai");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : describeError(e));
      setPhase("intro");
    }
  };

  // Pemindaian: frame berkala, baca sudut kepala, nyalakan garis cincin, simpan embedding per sektor.
  const isActive = phase === "posisi" || phase === "pindai";
  useEffect(() => {
    if (!isActive || !isCameraReady) return;
    let isCancelled = false;
    const mulai = Date.now();
    const samples: number[][] = [];
    const litTicks = new Set<number>();
    // Liveness saat mendaftar: perintah acak setelah cincin penuh (lihat Tantangan di atas); foto diam
    // atau video rekaman tidak bisa tahu perintahnya lebih dulu.
    let order: Challenge[] = [];
    let step = 0;
    let stepStartedAt = 0;
    let commandStartedAt = 0;
    let isNeutral = false; // pejam: mata terlihat terbuka; toleh: kepala di tengah, sejak perintah muncul
    let lastSampleAt = 0;
    let previous: number | null = null;
    let centerOf: number[] | null = null;
    const distance = (x: number, y: number) => {
      const d = Math.abs(x - y) % TICKS;
      return Math.min(d, TICKS - d);
    };
    const windowScores: number[] = [];
    const hasSpoofPassed = () =>
      !isSpoofAvailable() ||
      (windowScores.length >= SPOOF_MIN_SAMPLES &&
        median(windowScores) >= SPOOF_THRESHOLD);
    const takeSample = async () => {
      const f = await cameraRef.current?.takePictureAsync({
        quality: SAMPLE_QUALITY,
        skipProcessing: true,
        shutterSound: false,
      });
      if (!f) return null;
      const vec = await getFaceEmbedding(f.uri);
      const k = isSpoofAvailable() ? await getSpoofScore(f.uri) : null;
      if (k !== null) {
        windowScores.push(Math.round(k * 100) / 100);
        if (windowScores.length > SPOOF_WINDOW) windowScores.shift();
      }
      return vec;
    };
    const increment = (i: number) =>
      litTicks.add(((i % TICKS) + TICKS) % TICKS);

    (async () => {
      while (!isCancelled) {
        const limit = commandStartedAt
          ? commandStartedAt + COMMAND_TIMEOUT_MS
          : mulai + TIME_LIMIT_MS;
        if (Date.now() > limit) {
          showError("fe.habis");
          setPhase("intro");
          return;
        }
        try {
          const photo = await cameraRef.current?.takePictureAsync({
            quality: 0.25,
            skipProcessing: true,
            shutterSound: false,
          });
          if (isCancelled || !photo) continue;
          const d = await detectFace(photo.uri);
          if (isCancelled) return;
          if (d.count !== 1) {
            setHasFace(false);
            previous = null;
            showMessage(d.count === 0 ? "face.tidakAda" : "face.banyak");
            continue;
          }
          if (d.size < 0.15) {
            showMessage("face.dekat");
            continue;
          }
          setStatusMessage(null);
          // Pratinjau kamera depan seperti cermin: menoleh ke kiri tampak di kiri layar.
          const right = -d.yaw / YAW_MIN;
          const top = d.pitch / PITCH_MIN;
          const large = Math.hypot(right, top);
          setHasFace(true);
          if (!centerOf) {
            if (large < 0.6 && (d.eyesOpen < 0 || d.eyesOpen >= 0.5)) {
              centerOf = await takeSample();
              if (centerOf && !isCancelled) {
                samples.push(centerOf);
                setSelfieUri(photo.uri);
                setPhase("pindai");
              }
            }
            continue;
          }
          if (large >= 0.9) {
            const angle =
              ((Math.atan2(right, top) * 180) / Math.PI + 360) % 360;
            const idx = Math.round(angle / (360 / TICKS)) % TICKS;
            // Garis di antara arah frame sebelumnya dan sekarang ikut menyala, jadi gerakan melingkar
            // yang pelan mengisi cincin tanpa celah meski kamera hanya beberapa frame per detik.
            if (previous !== null && distance(previous, idx) <= 12) {
              const isForward = (idx - previous + TICKS) % TICKS <= TICKS / 2;
              const n = distance(previous, idx);
              for (let k = 0; k <= n; k++)
                increment(previous + (isForward ? k : -k));
            }
            for (let k = -2; k <= 2; k++) increment(idx + k);
            previous = idx;
            for (let i = 0; i < TICKS; i++) {
              if (litTicks.has(i)) continue;
              const hasLeftNeighbor =
                litTicks.has((i + TICKS - 1) % TICKS) ||
                litTicks.has((i + TICKS - 2) % TICKS);
              const hasRightNeighbor =
                litTicks.has((i + 1) % TICKS) || litTicks.has((i + 2) % TICKS);
              if (hasLeftNeighbor && hasRightNeighbor) litTicks.add(i);
            }
            setFilledTicks([...litTicks]);
          } else {
            previous = null;
          }
          // Sampel untuk pencocokan: hanya saat wajah menghadap depan dan mata terbuka, dari foto kualitas tinggi.
          // Wajah miring atau frame berkualitas rendah menurunkan kemiripan orang yang sama.
          if (
            large < 0.5 &&
            (d.eyesOpen < 0 || d.eyesOpen >= 0.5) &&
            (samples.length < SAMPLE_MAX || !hasSpoofPassed()) &&
            Date.now() - lastSampleAt > SAMPLE_GAP_MS
          ) {
            lastSampleAt = Date.now();
            const v = await takeSample();
            if (v && samples.length < SAMPLE_MAX) samples.push(v);
          }
          if (litTicks.size >= ENOUGH) {
            if (order.length === 0) {
              order = shuffleChallenges();
              step = 0;
              stepStartedAt = commandStartedAt = Date.now();
              isNeutral = false;
              setWarning(null);
              setChallenge({ kind: order[0]!, to: 1 });
            } else if (step >= order.length) {
              // Semua perintah beres; tinggal menunggu cukup sampel wajah menghadap depan.
              setChallenge(null);
              if (samples.length >= SAMPLE_MIN && hasSpoofPassed()) {
                for (let i = 0; i < TICKS; i++) litTicks.add(i);
                setFilledTicks([...litTicks]);
                embeddingSamples.current = samples;
                spoofResult.current = windowScores.length
                  ? {
                      mean:
                        Math.round(
                          (windowScores.reduce((a, b) => a + b, 0) /
                            windowScores.length) *
                            1000,
                        ) / 1000,
                      scores: [...windowScores],
                    }
                  : undefined;
                await new Promise((r) => setTimeout(r, 500));
                if (!isCancelled) setPhase("lengkap");
                return;
              }
              showWarning(
                samples.length >= SAMPLE_MIN && !hasSpoofPassed()
                  ? "fe.bukanAsli"
                  : "fe.hadapDepan",
              );
            } else {
              const j = order[step]!;
              let isConfirmed = false;
              if (j === "pejam") {
                // Mata harus terlihat terbuka dulu setelah perintah muncul, lalu tertutup.
                if (d.eyesOpen >= 0.5) isNeutral = true;
                isConfirmed = isNeutral && d.eyesOpen >= 0 && d.eyesOpen < 0.45;
              } else {
                // Mulai dari tengah, lalu menoleh ke kiri atau kanan.
                if (Math.abs(right) < 0.6) isNeutral = true;
                isConfirmed = isNeutral && Math.abs(right) >= 0.75;
              }
              if (isConfirmed) {
                step += 1;
                stepStartedAt = Date.now();
                isNeutral = false;
                setWarning(null);
                if (step < order.length) {
                  setChallenge({ kind: order[step]!, to: step + 1 });
                }
              } else if (Date.now() - stepStartedAt > HINT_MS) {
                showWarning(
                  j === "pejam" ? "fe.petunjukPejam" : "fe.petunjukToleh",
                );
              }
            }
          }
        } catch {
          // frame gagal: lanjut ke frame berikutnya sampai waktu habis
        }
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [isActive, isCameraReady, scanRound]);

  const mulai = async () => {
    setErrorMessage(null);
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) return;
    }
    setPhase("cek");
    try {
      if (!status?.ktpUrl || !status.profileUrl) throw new Error("syarat");
      const [ktpUri, profUri] = await Promise.all([
        saveAttachment(status.ktpUrl, "ktp"),
        saveAttachment(status.profileUrl, "profil"),
      ]);
      const ktp = await getFaceEmbedding(ktpUri);
      if (!ktp) throw new Error(t("fe.ktpTanpaWajah"));
      const prof = await getFaceEmbedding(profUri);
      if (!prof) throw new Error(t("fe.profilTanpaWajah"));
      acuan.current = { ktp, prof };
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : describeError(e));
      setPhase("intro");
      return;
    }
    setChallenge(null);
    setWarning(null);
    setFilledTicks([]);
    setSelfieUri(null);
    setStatusMessage(null);
    embeddingSamples.current = [];
    spoofResult.current = undefined;
    setIsCameraReady(false);
    setScanRound((n) => n + 1);
    setPhase("posisi");
  };

  const cancelScan = () => {
    setFilledTicks([]);
    setPhase("intro");
  };

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
      </View>
    );
  }

  if (phase === "selesai" || status?.state === "pending") {
    return (
      <View style={styles.container}>
        {lightHeader}
        <EmptyState
          icon="M5 13l4 4L19 7"
          title={t("fe.menunggu")}
          text={t("fe.menungguPesan")}
        />
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
