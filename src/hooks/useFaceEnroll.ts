import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useEnrollAnimations } from "@/hooks/useEnrollAnimations";
import { Animated } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import type { Kunci } from "@/i18n/id";
import { setTabBarHidden } from "@/navigation/tabBarVisibility";
import { saveAttachment } from "@/utils/attachment";
import {
  detectFace,
  getFaceEmbedding,
  getSpoofScore,
  isSpoofAvailable,
} from "@/services/faceCheck";
import type { FaceStatus, SpoofSummary } from "@/services/types";
import { TICKS } from "@/screens/profile/SamsungRing";

export const YAW_MIN = 11;

export const PITCH_MIN = 7;

export const ENOUGH = Math.round(TICKS * 0.92);

export type Challenge = "pejam" | "toleh";

export const HINT_MS = 8_000;

export const COMMAND_TIMEOUT_MS = 60_000;

export const shuffleChallenges = (): Challenge[] =>
  Math.random() < 0.5 ? ["pejam", "toleh"] : ["toleh", "pejam"];

export const SAMPLE_MIN = 3;

export const SAMPLE_MAX = 6;

export const SPOOF_MIN_SAMPLES = 4;

export const SPOOF_THRESHOLD = 0.5;

export const SPOOF_WINDOW = 8;

export const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export const SAMPLE_GAP_MS = 1200;

export const SAMPLE_QUALITY = 0.7;

export const TIME_LIMIT_MS = 90_000;

export type Phase =
  | "muat"
  | "intro"
  | "cek"
  | "posisi"
  | "pindai"
  | "lengkap"
  | "kirim"
  | "selesai";

export function useFaceEnroll() {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("muat");
  const [isCameraReady, setIsCameraReady] = useState(false);
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
  const acuan = useRef<{ ktp: number[]; prof: number[] } | null>(null);
  const embeddingSamples = useRef<number[][]>([]);
  const spoofResult = useRef<SpoofSummary | undefined>(undefined);
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
  return {
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
  };
}
