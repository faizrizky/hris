import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useT } from "@/i18n";
import {
  awalLiveness,
  deteksiWajah,
  langkahLiveness,
  tantanganAcak,
  type StatusLiveness,
  type Tantangan,
} from "@/services/faceCheck";

const BATAS_MS = 15_000;

// Kamera depan + tantangan acak. onLulus dipanggil sekali saat liveness lolos.
export function FaceCheck({ onLulus }: { onLulus: () => void }) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [izin, mintaIzin] = useCameraPermissions();
  const kamera = useRef<CameraView>(null);
  const [siapKamera, setSiapKamera] = useState(false);
  const [putaran, setPutaran] = useState(0); // naik = ulang dari awal
  const [tantangan, setTantangan] = useState<Tantangan>(tantanganAcak);
  const [status, setStatus] = useState<StatusLiveness>(awalLiveness);
  const [waktuHabis, setWaktuHabis] = useState(false);
  const [lulus, setLulus] = useState(false);

  useEffect(() => {
    if (!izin?.granted || !siapKamera) return;
    let batal = false;
    let s = awalLiveness;
    const mulai = Date.now();
    (async () => {
      while (!batal) {
        if (Date.now() - mulai > BATAS_MS) {
          setWaktuHabis(true);
          return;
        }
        try {
          const foto = await kamera.current?.takePictureAsync({
            quality: 0.3,
            skipProcessing: true,
            shutterSound: false,
          });
          if (batal) return;
          if (foto) {
            const d = await deteksiWajah(foto.uri);
            s = langkahLiveness(s, d, tantangan);
            if (!batal) setStatus(s);
            if (s.lulus) {
              setLulus(true);
              onLulus();
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
  }, [izin?.granted, siapKamera, putaran, tantangan, onLulus]);

  const ulang = () => {
    setTantangan(tantanganAcak());
    setStatus(awalLiveness);
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
      : status.pesan === "tantangan"
        ? t(tantangan === "kedip" ? "face.kedip" : "face.toleh")
        : t(`face.${status.pesan}` as never);

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
