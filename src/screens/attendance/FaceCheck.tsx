import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import { hrisApi } from "@/services/api";
import type { SpoofSummary } from "@/services/types";
import {
  initialSequence,
  STEP_TIMEOUT_MS,
  detectFace,
  getFaceEmbedding,
  getSpoofScore,
  isSpoofAvailable,
  advanceSequence,
  TOTAL_STEPS,
  type SequenceState,
} from "@/services/faceCheck";

const TIME_LIMIT_MS = 45_000; // seluruh sesi liveness (tiga perintah)
// Anti-spoofing membaca tekstur halus, jadi frame dibuat lebih tajam saat model tersedia.
const DETECTION_QUALITY = isSpoofAvailable() ? 0.6 : 0.3;
// Verifikasi hanya dengan anti-spoofing (tanpa perintah gerak): beberapa frame menghadap depan dinilai model, keputusan
// memakai median supaya satu frame buruk tidak menggagalkan wajah asli dan satu frame bagus tidak meloloskan foto/layar.
const SPOOF_CONSECUTIVE_FRAMES = 6; // lolos bila 6 frame BERUNTUN sama-sama di atas ambang (video di layar jarang konsisten)
const SPOOF_MAX_FRAMES = 16;
const SPOOF_THRESHOLD = 0.6;
const SPOOF_TIMEOUT_MS = 30_000;
const SAMPLE_QUALITY = 0.7; // foto untuk embedding wajah: lebih tajam supaya pencocokan akurat

// Kamera depan + tantangan acak. onLulus dipanggil sekali saat liveness lolos.
export function FaceCheck({
  onPass,
  action,
}: {
  onPass: (vec: number[] | null, spoof?: SpoofSummary) => void;
  action: "IN" | "OUT";
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [attemptRound, setAttemptRound] = useState(0); // naik = ulang dari awal
  const [status, setStatus] = useState<SequenceState>(initialSequence);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isLulus, setIsLulus] = useState(false);
  const [isNotGenuine, setIsNotGenuine] = useState(false);
  const [spoofMessageKey, setSpoofMessageKey] =
    useState<string>("face.spoofCek");

  useEffect(() => {
    if (!permission?.granted || !isCameraReady) return;
    let isCancelled = false;
    let s = initialSequence();
    let vec: number[] | null = null;
    const frameScores: number[] = [];
    const mulai = Date.now();
    if (isSpoofAvailable()) {
      // Hanya anti-spoofing: tanpa kedip/toleh.
      (async () => {
        const score: number[] = [];
        const logOutcome = (result: "Passed" | "Rejected" | "Timeout") => {
          hrisApi
            .logFaceCheck({
              logType: action,
              outcome: result,
              scores: score.slice(0, 40),
            })
            .catch(() => {});
        };
        const consecutiveCount = () => {
          let n = 0;
          for (
            let i = score.length - 1;
            i >= 0 && score[i]! >= SPOOF_THRESHOLD;
            i--
          )
            n++;
          return n;
        };
        while (!isCancelled) {
          if (Date.now() - mulai > SPOOF_TIMEOUT_MS) {
            logOutcome("Timeout");
            setHasTimedOut(true);
            return;
          }
          try {
            const photo = await cameraRef.current?.takePictureAsync({
              quality: DETECTION_QUALITY,
              skipProcessing: true,
              shutterSound: false,
            });
            if (isCancelled || !photo) continue;
            const d = await detectFace(photo.uri);
            if (isCancelled) return;
            if (d.count !== 1 || d.size < 0.25 || Math.abs(d.yaw) > 20) {
              setSpoofMessageKey(
                d.count === 0
                  ? "face.tidakAda"
                  : d.count > 1
                    ? "face.banyak"
                    : d.size < 0.25
                      ? "face.dekat"
                      : "face.depan",
              );
              continue;
            }
            setSpoofMessageKey("face.spoofCek");
            const k = await getSpoofScore(photo.uri);
            if (k !== null) score.push(Math.round(k * 100) / 100);
            // Embedding dari foto kualitas tinggi pada frame menghadap depan pertama.
            if (!vec) {
              const sharpPhoto = await cameraRef.current?.takePictureAsync({
                quality: SAMPLE_QUALITY,
                skipProcessing: true,
                shutterSound: false,
              });
              vec = await getFaceEmbedding((sharpPhoto ?? photo).uri);
            }
            if (consecutiveCount() >= SPOOF_CONSECUTIVE_FRAMES) {
              const lastScores = score.slice(-SPOOF_CONSECUTIVE_FRAMES);
              logOutcome("Passed");
              setIsLulus(true);
              onPass(vec, {
                mean:
                  Math.round(
                    (lastScores.reduce((a, b) => a + b, 0) /
                      lastScores.length) *
                      1000,
                  ) / 1000,
                scores: score.slice(0, 40),
              });
              return;
            }
            if (score.length >= SPOOF_MAX_FRAMES) {
              logOutcome("Rejected");
              setIsNotGenuine(true);
              return;
            }
          } catch {
            // frame gagal: coba lagi sampai waktu habis
          }
        }
      })();
      return () => {
        isCancelled = true;
      };
    }
    (async () => {
      while (!isCancelled) {
        const currentMs = Date.now();
        if (
          currentMs - mulai > TIME_LIMIT_MS ||
          (s.isReady && currentMs - s.stepStartedAt > STEP_TIMEOUT_MS)
        ) {
          setHasTimedOut(true);
          return;
        }
        try {
          const photo = await cameraRef.current?.takePictureAsync({
            quality: DETECTION_QUALITY,
            skipProcessing: true,
            shutterSound: false,
          });
          if (isCancelled) return;
          if (photo) {
            const d = await detectFace(photo.uri);
            s = advanceSequence(s, d, Date.now());
            // Mode bayangan: skor anti-spoofing tiap frame selama perintah berjalan, hanya dicatat.
            if (s.isReady && d.count === 1 && frameScores.length < 40) {
              const k = await getSpoofScore(photo.uri);
              if (k !== null) frameScores.push(Math.round(k * 100) / 100);
            }
            // Embedding dari foto kualitas tinggi saat menghadap depan, sebelum perintah pertama.
            if (s.isReady && !vec) {
              const sharpPhoto = await cameraRef.current?.takePictureAsync({
                quality: SAMPLE_QUALITY,
                skipProcessing: true,
                shutterSound: false,
              });
              vec = await getFaceEmbedding((sharpPhoto ?? photo).uri);
            }
            if (!isCancelled) setStatus(s);
            if (s.hasPassed) {
              setIsLulus(true);
              onPass(
                vec,
                frameScores.length
                  ? {
                      mean:
                        Math.round(
                          (frameScores.reduce((a, b) => a + b, 0) /
                            frameScores.length) *
                            1000,
                        ) / 1000,
                      scores: frameScores,
                    }
                  : undefined,
              );
              return;
            }
          }
        } catch {
          // frame gagal diambil: coba lagi sampai waktu habis
        }
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [permission?.granted, isCameraReady, attemptRound, onPass, action]);

  const restart = () => {
    setStatus(initialSequence());
    setHasTimedOut(false);
    setIsNotGenuine(false);
    setSpoofMessageKey("face.spoofCek");
    setAttemptRound((n) => n + 1);
  };

  if (!permission) return <View style={styles.box} />;
  if (!permission.granted) {
    return (
      <View style={styles.box}>
        <Text style={styles.message}>{t("face.izin")}</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t("face.beriIzin")}</Text>
        </Pressable>
      </View>
    );
  }

  const instruction = isLulus
    ? t("face.lulus")
    : isNotGenuine
      ? t("face.bukanAsli")
      : hasTimedOut
        ? t("face.habis")
        : isSpoofAvailable()
          ? t(spoofMessageKey as never)
          : status.message === "tantangan" && status.isReady
            ? `${t("face.langkah", { n: Math.min(status.step + 1, TOTAL_STEPS), total: TOTAL_STEPS })}: ${t(
                status.order[status.step] === "pejam"
                  ? "face.pejam"
                  : status.order[status.step] === "toleh"
                    ? "face.toleh1"
                    : "face.toleh2",
              )}`
            : t(
                `face.${status.message === "tantangan" ? "depan" : status.message}` as never,
              );

  return (
    <View style={{ alignItems: "center" }}>
      <View style={[styles.oval, isLulus && { borderColor: c.ok.ink }]}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          animateShutter={false}
          onCameraReady={() => setIsCameraReady(true)}
        />
      </View>
      <Text
        style={[
          styles.message,
          isLulus && { color: c.ok.ink },
          (hasTimedOut || isNotGenuine) && { color: c.bad.ink },
        ]}
      >
        {instruction}
      </Text>
      {(hasTimedOut || isNotGenuine) && (
        <Pressable style={styles.button} onPress={restart}>
          <Text style={styles.buttonText}>{t("face.ulang")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    box: { alignItems: "center", paddingVertical: 16 },
    oval: {
      width: 186,
      height: 232,
      borderRadius: 93,
      overflow: "hidden",
      borderWidth: 3,
      borderColor: c.accent,
      backgroundColor: c.track,
      marginTop: 14,
    },
    message: {
      fontSize: 12.5,
      fontWeight: "600",
      color: c.ink,
      marginTop: 14,
      textAlign: "center",
      paddingHorizontal: 12,
    },
    button: {
      ...primaryButtonStyle(c),
      marginTop: 12,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.accent,
    },
    buttonText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  });
