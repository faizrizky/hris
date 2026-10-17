import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import { hrisApi } from "@/services/api";
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
// Verifikasi hanya dengan anti-spoofing (tanpa perintah gerak): beberapa frame menghadap depan dinilai model, keputusan
// memakai median supaya satu frame buruk tidak menggagalkan wajah asli dan satu frame bagus tidak meloloskan foto/layar.
const SPOOF_BERUNTUN = 6; // lolos bila 6 frame BERUNTUN sama-sama di atas ambang (video di layar jarang konsisten)
const SPOOF_MAKS_FRAME = 16;
const SPOOF_AMBANG = 0.6;
const SPOOF_BATAS_MS = 30_000;
const KUALITAS_SAMPEL = 0.7; // foto untuk embedding wajah: lebih tajam supaya pencocokan akurat

// Kamera depan + tantangan acak. onLulus dipanggil sekali saat liveness lolos.
export function FaceCheck({
  onLulus,
  aksi,
}: {
  onLulus: (vec: number[] | null, spoof?: SpoofRingkas) => void;
  aksi: "IN" | "OUT";
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
  const [bukanAsli, setBukanAsli] = useState(false);
  const [pesanSpoof, setPesanSpoof] = useState<string>("face.spoofCek");

  useEffect(() => {
    if (!izin?.granted || !siapKamera) return;
    let batal = false;
    let s = status;
    let vec: number[] | null = null;
    const skorFrame: number[] = [];
    const mulai = Date.now();
    if (spoofTersedia()) {
      // Hanya anti-spoofing: tanpa kedip/toleh.
      (async () => {
        const skor: number[] = [];
        const catat = (hasil: "Passed" | "Rejected" | "Timeout") => {
          hrisApi
            .logFaceCheck({
              logType: aksi,
              outcome: hasil,
              scores: skor.slice(0, 40),
            })
            .catch(() => {});
        };
        const beruntun = () => {
          let n = 0;
          for (let i = skor.length - 1; i >= 0 && skor[i]! >= SPOOF_AMBANG; i--)
            n++;
          return n;
        };
        while (!batal) {
          if (Date.now() - mulai > SPOOF_BATAS_MS) {
            catat("Timeout");
            setWaktuHabis(true);
            return;
          }
          try {
            const foto = await kamera.current?.takePictureAsync({
              quality: KUALITAS_DETEKSI,
              skipProcessing: true,
              shutterSound: false,
            });
            if (batal || !foto) continue;
            const d = await deteksiWajah(foto.uri);
            if (batal) return;
            if (d.count !== 1 || d.size < 0.25 || Math.abs(d.yaw) > 20) {
              setPesanSpoof(
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
            setPesanSpoof("face.spoofCek");
            const k = await skorSpoof(foto.uri);
            if (k !== null) skor.push(Math.round(k * 100) / 100);
            // Embedding dari foto kualitas tinggi pada frame menghadap depan pertama.
            if (!vec) {
              const tajam = await kamera.current?.takePictureAsync({
                quality: KUALITAS_SAMPEL,
                skipProcessing: true,
                shutterSound: false,
              });
              vec = await embeddingWajah((tajam ?? foto).uri);
            }
            if (beruntun() >= SPOOF_BERUNTUN) {
              const jendela = skor.slice(-SPOOF_BERUNTUN);
              catat("Passed");
              setLulus(true);
              onLulus(vec, {
                mean:
                  Math.round(
                    (jendela.reduce((a, b) => a + b, 0) / jendela.length) *
                      1000,
                  ) / 1000,
                scores: skor.slice(0, 40),
              });
              return;
            }
            if (skor.length >= SPOOF_MAKS_FRAME) {
              catat("Rejected");
              setBukanAsli(true);
              return;
            }
          } catch {
            // frame gagal: coba lagi sampai waktu habis
          }
        }
      })();
      return () => {
        batal = true;
      };
    }
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
    setBukanAsli(false);
    setPesanSpoof("face.spoofCek");
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
    : bukanAsli
      ? t("face.bukanAsli")
      : waktuHabis
        ? t("face.habis")
        : spoofTersedia()
          ? t(pesanSpoof as never)
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
          (waktuHabis || bukanAsli) && { color: c.bad.ink },
        ]}
      >
        {instruksi}
      </Text>
      {(waktuHabis || bukanAsli) && (
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
