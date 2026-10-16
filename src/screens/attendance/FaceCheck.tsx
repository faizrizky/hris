import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import type { SpoofRingkas } from "@/services/types";
import {
  awalUrutan,
  BATAS_LANGKAH_MS,
  deteksiWajah,
  embeddingWajah,
  skorSpoof,
  spoofTersedia,
  langkahUrutan,
  LANGKAH_TOTAL,
  type StatusUrutan,
} from "@/services/faceCheck";

const BATAS_MS = 45_000; // seluruh sesi liveness (tiga perintah)
// Anti-spoofing membaca tekstur halus, jadi frame dibuat lebih tajam saat model tersedia.
const KUALITAS_DETEKSI = spoofTersedia() ? 0.6 : 0.3;
const KUALITAS_SAMPEL = 0.7; // foto untuk embedding wajah: lebih tajam supaya pencocokan akurat

// Kamera depan + tantangan acak. onLulus dipanggil sekali saat liveness lolos.
export function FaceCheck({
  onLulus,
}: {
  onLulus: (vec: number[] | null, spoof?: SpoofRingkas) => void;
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [izin, mintaIzin] = useCameraPermissions();
  const kamera = useRef<CameraView>(null);
  const [siapKamera, setSiapKamera] = useState(false);
  const [putaran, setPutaran] = useState(0); // naik = ulang dari awal
  const [status, setStatus] = useState<StatusUrutan>(awalUrutan);
  const [waktuHabis, setWaktuHabis] = useState(false);
  const [lulus, setLulus] = useState(false);

  useEffect(() => {
    if (!izin?.granted || !siapKamera) return;
    let batal = false;
    let s = status;
    let vec: number[] | null = null;
    const skorFrame: number[] = [];
    const mulai = Date.now();
    (async () => {
      while (!batal) {
        const sekarang = Date.now();
        if (
          sekarang - mulai > BATAS_MS ||
          (s.siap && sekarang - s.mulaiLangkah > BATAS_LANGKAH_MS)
        ) {
          setWaktuHabis(true);
          return;
        }
        try {
          const foto = await kamera.current?.takePictureAsync({
            quality: KUALITAS_DETEKSI,
            skipProcessing: true,
            shutterSound: false,
          });
          if (batal) return;
          if (foto) {
            const d = await deteksiWajah(foto.uri);
            s = langkahUrutan(s, d, Date.now());
            // Mode bayangan: skor anti-spoofing tiap frame selama perintah berjalan, hanya dicatat.
            if (s.siap && d.count === 1 && skorFrame.length < 40) {
              const k = await skorSpoof(foto.uri);
              if (k !== null) skorFrame.push(Math.round(k * 100) / 100);
            }
            // Embedding dari foto kualitas tinggi saat menghadap depan, sebelum perintah pertama.
            if (s.siap && !vec) {
              const tajam = await kamera.current?.takePictureAsync({
                quality: KUALITAS_SAMPEL,
                skipProcessing: true,
                shutterSound: false,
              });
              vec = await embeddingWajah((tajam ?? foto).uri);
            }
            if (!batal) setStatus(s);
            if (s.lulus) {
              setLulus(true);
              onLulus(
                vec,
                skorFrame.length
                  ? {
                      mean:
                        Math.round(
                          (skorFrame.reduce((a, b) => a + b, 0) /
                            skorFrame.length) *
                            1000,
                        ) / 1000,
                      scores: skorFrame,
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
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [izin?.granted, siapKamera, putaran, onLulus]);

  const ulang = () => {
    setStatus(awalUrutan());
    setWaktuHabis(false);
    setPutaran((n) => n + 1);
  };

  if (!izin) return <View style={styles.box} />;
  if (!izin.granted) {
    return (
      <View style={styles.box}>
        <Text style={styles.pesan}>{t("face.izin")}</Text>
        <Pressable style={styles.tombol} onPress={mintaIzin}>
          <Text style={styles.tombolText}>{t("face.beriIzin")}</Text>
        </Pressable>
      </View>
    );
  }

  const instruksi = lulus
    ? t("face.lulus")
    : waktuHabis
      ? t("face.habis")
      : status.pesan === "tantangan" && status.siap
        ? `${t("face.langkah", { n: Math.min(status.langkah + 1, LANGKAH_TOTAL), total: LANGKAH_TOTAL })}: ${t(
            status.urutan[status.langkah] === "pejam"
              ? "face.pejam"
              : status.urutan[status.langkah] === "toleh"
                ? "face.toleh1"
                : "face.toleh2",
          )}`
        : t(
            `face.${status.pesan === "tantangan" ? "depan" : status.pesan}` as never,
          );

  return (
    <View style={{ alignItems: "center" }}>
      <View style={[styles.oval, lulus && { borderColor: c.ok.ink }]}>
        <CameraView
          ref={kamera}
          style={StyleSheet.absoluteFill}
          facing="front"
          animateShutter={false}
          onCameraReady={() => setSiapKamera(true)}
        />
      </View>
      <Text
        style={[
          styles.pesan,
          lulus && { color: c.ok.ink },
          waktuHabis && { color: c.bad.ink },
        ]}
      >
        {instruksi}
      </Text>
      {waktuHabis && (
        <Pressable style={styles.tombol} onPress={ulang}>
          <Text style={styles.tombolText}>{t("face.ulang")}</Text>
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
    pesan: {
      fontSize: 12.5,
      fontWeight: "600",
      color: c.ink,
      marginTop: 14,
      textAlign: "center",
      paddingHorizontal: 12,
    },
    tombol: {
      marginTop: 12,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.accent,
    },
    tombolText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  });
