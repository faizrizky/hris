import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import { kembali } from "@/navigation/kembali";
import { EmptyState } from "@/components/EmptyState";
import { simpanLampiran } from "@/utils/lampiran";
import {
  deteksiWajah,
  embeddingWajah,
  wajahDidukung,
} from "@/services/faceCheck";
import type { FaceStatus } from "@/services/types";

const TICKS = 48;
const SECTORS = 8; // arah kepala yang harus terisi, selain menghadap depan
const SIZE = 264;
const R_IN = 116;
const R_OUT = 128;
const BATAS_MS = 90_000;

type Fase = "muat" | "siap" | "pindai" | "kirim" | "selesai";

// Pendaftaran wajah bergaya Face ID: garis di sekeliling lingkaran menyala
// hijau sesuai arah kepala. Satu embedding disimpan per arah.
export function FaceEnrollScreen({ navigation }: any) {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [izin, mintaIzin] = useCameraPermissions();
  const kamera = useRef<CameraView>(null);
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [fase, setFase] = useState<Fase>("muat");
  const [siapKamera, setSiapKamera] = useState(false);
  const [terisi, setTerisi] = useState<boolean[]>(() =>
    Array(TICKS).fill(false),
  );
  const [pesan, setPesan] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    hrisApi
      .getFaceStatus()
      .then((s) => {
        setStatus(s);
        setFase("siap");
      })
      .catch((e) => {
        setGalat(describeError(e));
        setFase("siap");
      });
  }, []);

  // Pemindaian: ambil frame berkala, baca sudut kepala, nyalakan garis, simpan
  // embedding saat arah baru tercapai.
  useEffect(() => {
    if (fase !== "pindai" || !siapKamera) return;
    let batal = false;
    const mulai = Date.now();
    const sampel: number[][] = [];
    const sektor = new Set<number>();
    let pusat: number[] | null = null;
    let selfie: string | null = null;
    const nyala = Array(TICKS).fill(false) as boolean[];

    (async () => {
      while (!batal) {
        if (Date.now() - mulai > BATAS_MS) {
          setGalat(t("fe.habis"));
          setFase("siap");
          return;
        }
        try {
          const foto = await kamera.current?.takePictureAsync({
            quality: 0.4,
            skipProcessing: true,
            shutterSound: false,
          });
          if (batal || !foto) continue;
          const d = await deteksiWajah(foto.uri);
          if (batal) return;
          if (d.count !== 1) {
            setPesan(t(d.count === 0 ? "face.tidakAda" : "face.banyak"));
            continue;
          }
          if (d.size < 0.25) {
            setPesan(t("face.dekat"));
            continue;
          }
          if (d.eyesOpen >= 0 && d.eyesOpen < 0.4) continue;
          const besar = Math.hypot(d.yaw, d.pitch);
          if (besar < 10) {
            if (!pusat) {
              pusat = await embeddingWajah(foto.uri);
              if (pusat) {
                sampel.push(pusat);
                selfie = foto.uri;
              }
            }
            setPesan(t(pusat ? "fe.putar" : "face.depan"));
          } else if (pusat && besar >= 12) {
            const derajat =
              ((Math.atan2(-d.pitch, d.yaw) * 180) / Math.PI + 90 + 360) % 360;
            const idx = Math.round(derajat / (360 / TICKS)) % TICKS;
            for (let k = -2; k <= 2; k++) {
              nyala[(idx + k + TICKS) % TICKS] = true;
            }
            setTerisi([...nyala]);
            const s = Math.floor(idx / (TICKS / SECTORS));
            if (!sektor.has(s)) {
              const v = await embeddingWajah(foto.uri);
              if (v) {
                sektor.add(s);
                sampel.push(v);
              }
            }
            setPesan(t("fe.putar"));
          }
          if (pusat && sektor.size >= SECTORS - 1) {
            setTerisi(Array(TICKS).fill(true));
            setFase("kirim");
            await kirim(sampel, selfie, () => batal);
            return;
          }
        } catch {
          // frame gagal: lanjut ke frame berikutnya sampai waktu habis
        }
      }
    })();
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, siapKamera, putaran]);

  const kirim = async (
    sampel: number[][],
    selfie: string | null,
    dibatalkan: () => boolean,
  ) => {
    try {
      if (!status?.ktpUrl || !status.profileUrl) throw new Error("syarat");
      const [ktpUri, profUri] = await Promise.all([
        simpanLampiran(status.ktpUrl, "ktp"),
        simpanLampiran(status.profileUrl, "profil"),
      ]);
      const ktp = await embeddingWajah(ktpUri);
      if (!ktp) throw new Error(t("fe.ktpTanpaWajah"));
      const prof = await embeddingWajah(profUri);
      if (!prof) throw new Error(t("fe.profilTanpaWajah"));
      if (dibatalkan()) return;
      await hrisApi.submitFaceEnrollment({
        embeddings: sampel,
        ktpEmbedding: ktp,
        profileEmbedding: prof,
        selfie: selfie
          ? { uri: selfie, name: "selfie.jpg", mimeType: "image/jpeg" }
          : undefined,
      });
      setFase("selesai");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : describeError(e));
      setFase("siap");
    }
  };

  const mulai = () => {
    setGalat(null);
    setPesan(t("face.depan"));
    setTerisi(Array(TICKS).fill(false));
    setSiapKamera(false);
    setPutaran((n) => n + 1);
    setFase("pindai");
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>{t("fe.judul")}</Text>
    </View>
  );

  if (!wajahDidukung()) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          title={t("fe.tidakDidukung")}
          text={t("face.tidakDidukung")}
        />
      </View>
    );
  }

  if (fase === "muat") {
    return <View style={styles.container}>{header}</View>;
  }

  const syaratKurang = status && (!status.ktpUrl || !status.profileUrl);
  if (syaratKurang && status) {
    const butuhKtp = !status.ktpUrl;
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          title={t(butuhKtp ? "fe.butuhKtp" : "fe.butuhFoto")}
          text={t(butuhKtp ? "fe.butuhKtpPesan" : "fe.butuhFotoPesan")}
        >
          <Pressable
            style={styles.btn}
            onPress={() =>
              navigation.navigate(butuhKtp ? "ProfileDocs" : "ProfilePhoto")
            }
          >
            <Text style={styles.btnText}>
              {t(butuhKtp ? "fe.keDokumen" : "fe.keFoto")}
            </Text>
          </Pressable>
        </EmptyState>
      </View>
    );
  }

  if (fase === "selesai" || status?.state === "pending") {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="M5 13l4 4L19 7"
          title={t("fe.menunggu")}
          text={t("fe.menungguPesan")}
        />
      </View>
    );
  }

  const scanning = fase === "pindai" || fase === "kirim";
  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        {!scanning && status?.state === "active" ? (
          <View style={styles.info}>
            <Text style={styles.infoText}>{t("fe.sudahAktif")}</Text>
          </View>
        ) : null}
        {!scanning && status?.state === "needs_reenroll" ? (
          <View style={[styles.info, { backgroundColor: c.warn.bg }]}>
            <Text style={[styles.infoText, { color: c.warn.ink }]}>
              {t("fe.perluDaftarUlang", { tgl: status.graceUntil ?? "-" })}
            </Text>
          </View>
        ) : null}
        {!scanning && status?.state === "rejected" ? (
          <View style={[styles.info, { backgroundColor: c.bad.bg }]}>
            <Text style={[styles.infoText, { color: c.bad.ink }]}>
              {t("fe.ditolak", { alasan: status.note ?? "-" })}
            </Text>
          </View>
        ) : null}

        <View style={styles.ringWrap}>
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            {Array.from({ length: TICKS }, (_, i) => {
              const a = ((i * 360) / TICKS - 90) * (Math.PI / 180);
              const cx = SIZE / 2;
              return (
                <Line
                  key={i}
                  x1={cx + R_IN * Math.cos(a)}
                  y1={cx + R_IN * Math.sin(a)}
                  x2={cx + R_OUT * Math.cos(a)}
                  y2={cx + R_OUT * Math.sin(a)}
                  stroke={terisi[i] ? c.ok.ink : c.track}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
          <View style={styles.cam}>
            {scanning && izin?.granted ? (
              <CameraView
                ref={kamera}
                style={StyleSheet.absoluteFill}
                facing="front"
                animateShutter={false}
                onCameraReady={() => setSiapKamera(true)}
              />
            ) : (
              <Ionicons name="person" size={72} color={c.mutedLabel} />
            )}
          </View>
        </View>

        <Text style={styles.pesan}>
          {fase === "kirim"
            ? t("fe.mengirim")
            : scanning
              ? (pesan ?? t("face.depan"))
              : t("fe.petunjuk")}
        </Text>
        {galat ? <Text style={styles.galat}>{galat}</Text> : null}

        {!scanning ? (
          izin && !izin.granted ? (
            <Pressable style={styles.btn} onPress={mintaIzin}>
              <Text style={styles.btnText}>{t("face.beriIzin")}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.btn} onPress={mulai}>
              <Text style={styles.btnText}>
                {t(
                  status?.state === "active" ||
                    status?.state === "needs_reenroll"
                    ? "fe.daftarUlang"
                    : "fe.mulai",
                )}
              </Text>
            </Pressable>
          )
        ) : null}
      </ScrollView>
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
    content: { padding: 18, alignItems: "center", paddingBottom: 40 },
    info: {
      alignSelf: "stretch",
      backgroundColor: c.ok.bg,
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
    },
    infoText: { fontSize: 12, fontWeight: "600", color: c.ok.ink },
    ringWrap: {
      width: SIZE,
      height: SIZE,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    cam: {
      width: 214,
      height: 214,
      borderRadius: 107,
      overflow: "hidden",
      backgroundColor: c.track,
      alignItems: "center",
      justifyContent: "center",
    },
    pesan: {
      fontSize: 14,
      fontWeight: "700",
      color: c.ink,
      textAlign: "center",
      marginTop: 22,
      paddingHorizontal: 12,
    },
    galat: {
      fontSize: 12,
      color: c.bad.ink,
      textAlign: "center",
      marginTop: 10,
    },
    btn: {
      marginTop: 22,
      alignSelf: "stretch",
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
      backgroundColor: c.accent,
    },
    btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  });
