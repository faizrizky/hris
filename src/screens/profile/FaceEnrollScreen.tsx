import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import { kembali } from "@/navigation/kembali";
import { setTabBarHidden } from "@/navigation/tabBarVisibility";
import { EmptyState } from "@/components/EmptyState";
import { simpanLampiran } from "@/utils/lampiran";
import {
  deteksiWajah,
  embeddingWajah,
  wajahDidukung,
} from "@/services/faceCheck";
import type { FaceStatus } from "@/services/types";
import { CincinWajah, TICKS } from "./CincinWajah";

// Sudut kepala (derajat) yang dianggap "sampai" ke tepi lingkaran. Mendongak/menunduk lebih sulit
// daripada menoleh, jadi ambangnya lebih kecil; arah diagonal memakai kombinasi keduanya (elips).
const YAW_MIN = 11;
const PITCH_MIN = 7;
const CUKUP = Math.round(TICKS * 0.92); // sisa celah kecil diisi otomatis
const SEKTOR = 8; // satu sampel wajah per seperdelapan lingkaran
const BATAS_MS = 90_000;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

// Warna layar Face ID: selalu gelap, apa pun tema aplikasinya.
const HITAM = "#000000";
const PUTIH = "#FFFFFF";
const REDUP = "rgba(255,255,255,0.62)";
const BIRU = "#0A84FF";

type Fase =
  | "muat"
  | "intro"
  | "cek"
  | "posisi"
  | "pindai"
  | "lengkap"
  | "kirim"
  | "selesai";

// Pendaftaran wajah meniru alur Face ID: panduan, posisikan wajah di bingkai,
// kamera mengecil menjadi lingkaran, putar kepala sampai cincin hijau penuh,
// lalu "Pemindaian wajah selesai".
export function FaceEnrollScreen({ navigation }: any) {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [izin, mintaIzin] = useCameraPermissions();
  const kamera = useRef<CameraView>(null);
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [fase, setFase] = useState<Fase>("muat");
  const [siapKamera, setSiapKamera] = useState(false);
  const [terisi, setTerisi] = useState<number[]>([]);
  const [pesan, setPesan] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [putaran, setPutaran] = useState(0);
  // Embedding KTP dan foto profil dihitung SEBELUM pemindaian, supaya foto yang tidak berisi wajah
  // ketahuan sebelum karyawan memutar kepala.
  const acuan = useRef<{ ktp: number[]; prof: number[] } | null>(null);
  const hasil = useRef<number[][]>([]);

  // Animasi: kamera penuh -> lingkaran, bingkai sudut berdenyut, pita pemindai, cincin panduan berputar.
  const [bentuk] = useState(() => new Animated.Value(0));
  const [denyut] = useState(() => new Animated.Value(0));
  const [sapu] = useState(() => new Animated.Value(0));
  const [putar] = useState(() => new Animated.Value(0));
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
        setFase("intro");
      })
      .catch((e) => {
        setGalat(describeError(e));
        setFase("intro");
      });
  }, []);

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.timing(putar, {
          toValue: 1,
          duration: 14000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(denyut, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(denyut, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.timing(sapu, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [putar, denyut, sapu]);

  // Setiap ganti tahap: isi memudar masuk; kamera berubah bentuk saat pemindaian dimulai.
  useEffect(() => {
    masuk.setValue(0);
    Animated.timing(masuk, {
      toValue: 1,
      duration: 420,
      easing: EASE,
      useNativeDriver: true,
    }).start();
    if (fase === "posisi") bentuk.setValue(0);
    if (fase === "pindai") {
      Animated.timing(bentuk, {
        toValue: 1,
        duration: 650,
        easing: EASE,
        useNativeDriver: false,
      }).start();
    }
  }, [fase, bentuk, masuk]);

  const kirim = async () => {
    setFase("kirim");
    try {
      if (!acuan.current) throw new Error("syarat");
      await hrisApi.submitFaceEnrollment({
        embeddings: hasil.current,
        ktpEmbedding: acuan.current.ktp,
        profileEmbedding: acuan.current.prof,
        selfie: selfie
          ? { uri: selfie, name: "selfie.jpg", mimeType: "image/jpeg" }
          : undefined,
      });
      setFase("selesai");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : describeError(e));
      setFase("intro");
    }
  };

  // Pemindaian: frame berkala, baca sudut kepala, nyalakan garis cincin, simpan embedding per sektor.
  const aktif = fase === "posisi" || fase === "pindai";
  useEffect(() => {
    if (!aktif || !siapKamera) return;
    let batal = false;
    const mulai = Date.now();
    const sampel: number[][] = [];
    const nyala = new Set<number>();
    const sektor = new Set<number>();
    let sebelumnya: number | null = null;
    let pusat: number[] | null = null;
    const jarak = (x: number, y: number) => {
      const d = Math.abs(x - y) % TICKS;
      return Math.min(d, TICKS - d);
    };
    const tambah = (i: number) => nyala.add(((i % TICKS) + TICKS) % TICKS);

    (async () => {
      while (!batal) {
        if (Date.now() - mulai > BATAS_MS) {
          setGalat(t("fe.habis"));
          setFase("intro");
          return;
        }
        try {
          const foto = await kamera.current?.takePictureAsync({
            quality: 0.25,
            skipProcessing: true,
            shutterSound: false,
          });
          if (batal || !foto) continue;
          const d = await deteksiWajah(foto.uri);
          if (batal) return;
          if (d.count !== 1) {
            sebelumnya = null;
            setPesan(t(d.count === 0 ? "face.tidakAda" : "face.banyak"));
            continue;
          }
          if (d.size < 0.15) {
            setPesan(t("face.dekat"));
            continue;
          }
          setPesan(null);
          // Pratinjau kamera depan seperti cermin: menoleh ke kiri tampak di kiri layar.
          const kanan = -d.yaw / YAW_MIN;
          const atas = d.pitch / PITCH_MIN;
          const besar = Math.hypot(kanan, atas);
          if (!pusat) {
            if (besar < 0.6 && (d.eyesOpen < 0 || d.eyesOpen >= 0.5)) {
              pusat = await embeddingWajah(foto.uri);
              if (pusat && !batal) {
                sampel.push(pusat);
                setSelfie(foto.uri);
                setFase("pindai");
              }
            }
            continue;
          }
          if (besar >= 0.9) {
            const sudut =
              ((Math.atan2(kanan, atas) * 180) / Math.PI + 360) % 360;
            const idx = Math.round(sudut / (360 / TICKS)) % TICKS;
            // Garis di antara arah frame sebelumnya dan sekarang ikut menyala, jadi gerakan melingkar
            // yang pelan mengisi cincin tanpa celah meski kamera hanya beberapa frame per detik.
            if (sebelumnya !== null && jarak(sebelumnya, idx) <= 12) {
              const maju = (idx - sebelumnya + TICKS) % TICKS <= TICKS / 2;
              const n = jarak(sebelumnya, idx);
              for (let k = 0; k <= n; k++) tambah(sebelumnya + (maju ? k : -k));
            }
            for (let k = -2; k <= 2; k++) tambah(idx + k);
            sebelumnya = idx;
            for (let i = 0; i < TICKS; i++) {
              if (nyala.has(i)) continue;
              const kiri =
                nyala.has((i + TICKS - 1) % TICKS) ||
                nyala.has((i + TICKS - 2) % TICKS);
              const kanan2 =
                nyala.has((i + 1) % TICKS) || nyala.has((i + 2) % TICKS);
              if (kiri && kanan2) nyala.add(i);
            }
            setTerisi([...nyala]);
            const s8 = Math.floor(idx / (TICKS / SEKTOR));
            if (!sektor.has(s8)) {
              sektor.add(s8);
              const v = await embeddingWajah(foto.uri);
              if (v) sampel.push(v);
            }
          } else {
            sebelumnya = null;
          }
          if (nyala.size >= CUKUP) {
            for (let i = 0; i < TICKS; i++) nyala.add(i);
            setTerisi([...nyala]);
            hasil.current = sampel;
            await new Promise((r) => setTimeout(r, 500));
            if (!batal) setFase("lengkap");
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
  }, [aktif, siapKamera, putaran]);

  const mulai = async () => {
    setGalat(null);
    if (!izin?.granted) {
      const r = await mintaIzin();
      if (!r.granted) return;
    }
    setFase("cek");
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
      acuan.current = { ktp, prof };
    } catch (e) {
      setGalat(e instanceof Error ? e.message : describeError(e));
      setFase("intro");
      return;
    }
    setTerisi([]);
    setSelfie(null);
    setPesan(null);
    hasil.current = [];
    setSiapKamera(false);
    setPutaran((n) => n + 1);
    setFase("posisi");
  };

  const batalPindai = () => {
    setTerisi([]);
    setFase("intro");
  };

  const headerTerang = (
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
        {headerTerang}
        <EmptyState
          title={t("fe.tidakDidukung")}
          text={t("face.tidakDidukung")}
        />
      </View>
    );
  }

  if (fase === "muat") {
    return <View style={[styles.container, { backgroundColor: HITAM }]} />;
  }

  const syaratKurang = status && (!status.ktpUrl || !status.profileUrl);
  if (syaratKurang && status) {
    const butuhKtp = !status.ktpUrl;
    return (
      <View style={styles.container}>
        {headerTerang}
        <EmptyState
          title={t(butuhKtp ? "fe.butuhKtp" : "fe.butuhFoto")}
          text={t(butuhKtp ? "fe.butuhKtpPesan" : "fe.butuhFotoPesan")}
        >
          <Pressable
            style={styles.btnTerang}
            onPress={() =>
              navigation.navigate(butuhKtp ? "ProfileDocs" : "ProfilePhoto")
            }
          >
            <Text style={styles.btnTerangText}>
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
        {headerTerang}
        <EmptyState
          icon="M5 13l4 4L19 7"
          title={t("fe.menunggu")}
          text={t("fe.menungguPesan")}
        />
      </View>
    );
  }

  // ---- Layar gelap ala Face ID ----
  const D = Math.min(W * 0.66, 270); // diameter foto dalam lingkaran
  const RING = D + 72; // kanvas cincin
  const atasLingkaran = insets.top + 96;
  const tinggiPenuh = Math.round(W * 1.18);
  const atasPenuh = insets.top + 52;
  const kotak = {
    position: "absolute" as const,
    overflow: "hidden" as const,
    left: bentuk.interpolate({
      inputRange: [0, 1],
      outputRange: [0, (W - D) / 2],
    }),
    top: bentuk.interpolate({
      inputRange: [0, 1],
      outputRange: [atasPenuh, atasLingkaran],
    }),
    width: bentuk.interpolate({ inputRange: [0, 1], outputRange: [W, D] }),
    height: bentuk.interpolate({
      inputRange: [0, 1],
      outputRange: [tinggiPenuh, D],
    }),
    borderRadius: bentuk.interpolate({
      inputRange: [0, 1],
      outputRange: [0, D / 2],
    }),
  };
  const munculkan = {
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
  const kameraTampil =
    fase === "posisi" || fase === "pindai" || fase === "lengkap";
  const teksBawahTop =
    fase === "posisi" ? atasPenuh + tinggiPenuh + 28 : atasLingkaran + D + 62;

  return (
    <View style={[styles.container, { backgroundColor: HITAM }]}>
      <StatusBar style="light" />

      {kameraTampil ? (
        <Animated.View style={kotak}>
          <CameraView
            ref={kamera}
            style={StyleSheet.absoluteFill}
            facing="front"
            animateShutter={false}
            onCameraReady={() => setSiapKamera(true)}
          />
          {fase === "pindai" ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pitaH,
                  {
                    transform: [
                      {
                        translateY: sapu.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [-40, D, -40],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={[
                    "rgba(120,230,255,0)",
                    "rgba(120,230,255,0.45)",
                    "rgba(120,230,255,0)",
                  ]}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pitaV,
                  {
                    transform: [
                      {
                        translateX: sapu.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [D, -40, D],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  colors={[
                    "rgba(120,230,255,0)",
                    "rgba(120,230,255,0.35)",
                    "rgba(120,230,255,0)",
                  ]}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </>
          ) : null}
          {fase === "lengkap" && selfie ? (
            <Animated.Image
              source={{ uri: selfie }}
              blurRadius={22}
              style={[StyleSheet.absoluteFill, { opacity: masuk }]}
            />
          ) : null}
        </Animated.View>
      ) : null}

      {fase === "posisi" ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bingkai,
            {
              width: W * 0.62,
              height: W * 0.62,
              left: W * 0.19,
              top: atasPenuh + tinggiPenuh / 2 - W * 0.31,
              transform: [
                {
                  scale: denyut.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.95],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.sudut, styles.sudutKiriAtas]} />
          <View style={[styles.sudut, styles.sudutKananAtas]} />
          <View style={[styles.sudut, styles.sudutKiriBawah]} />
          <View style={[styles.sudut, styles.sudutKananBawah]} />
        </Animated.View>
      ) : null}

      {fase === "pindai" || fase === "lengkap" || fase === "kirim" ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: RING,
            height: RING,
            left: (W - RING) / 2,
            top: atasLingkaran - (RING - D) / 2,
            opacity: bentuk,
          }}
        >
          <CincinWajah
            size={RING}
            rIn={D / 2 + 12}
            terisi={terisi}
            selesai={fase !== "pindai"}
            rFoto={D / 2 + 3}
          />
        </Animated.View>
      ) : null}

      {fase === "intro" || fase === "cek" ? (
        <Animated.View
          style={[
            styles.introWrap,
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 },
            munculkan,
          ]}
        >
          <View style={styles.introIkon}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    {
                      rotate: putar.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                },
              ]}
            >
              <CincinWajah size={200} rIn={70} terisi={[]} rFoto={60} />
            </Animated.View>
            <Ionicons name="happy-outline" size={78} color={PUTIH} />
          </View>
          <Text style={styles.introJudul}>{t("fe.introJudul")}</Text>
          <Text style={styles.introIsi}>{t("fe.introIsi")}</Text>
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
          {galat ? <Text style={styles.galat}>{galat}</Text> : null}
          <View style={{ flex: 1 }} />
          <Pressable
            style={[styles.btnBiru, fase === "cek" && { opacity: 0.6 }]}
            onPress={mulai}
            disabled={fase === "cek"}
          >
            {fase === "cek" ? (
              <View style={styles.cekRow}>
                <ActivityIndicator color={PUTIH} />
                <Text style={styles.btnBiruText}>{t("fe.memeriksa")}</Text>
              </View>
            ) : (
              <Text style={styles.btnBiruText}>
                {t(
                  status?.state === "active" ||
                    status?.state === "needs_reenroll"
                    ? "fe.daftarUlang"
                    : "fe.mulaiSingkat",
                )}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.teksBawah,
            { top: teksBawahTop, paddingBottom: insets.bottom + 24 },
            munculkan,
          ]}
        >
          <Text style={styles.instruksi}>
            {fase === "posisi"
              ? t("fe.posisi")
              : fase === "pindai"
                ? t("fe.lingkarFaceId")
                : t("fe.lengkap")}
          </Text>
          {pesan && aktif ? <Text style={styles.petunjuk}>{pesan}</Text> : null}
          <View style={{ flex: 1 }} />
          {fase === "lengkap" || fase === "kirim" ? (
            <Pressable
              style={[styles.btnBiru, fase === "kirim" && { opacity: 0.6 }]}
              onPress={kirim}
              disabled={fase === "kirim"}
            >
              {fase === "kirim" ? (
                <ActivityIndicator color={PUTIH} />
              ) : (
                <Text style={styles.btnBiruText}>{t("fe.lanjutkan")}</Text>
              )}
            </Pressable>
          ) : null}
        </Animated.View>
      )}

      <Pressable
        style={[styles.batal, { top: insets.top + 12 }]}
        onPress={() =>
          fase === "intro" || fase === "cek"
            ? kembali(navigation)
            : batalPindai()
        }
        hitSlop={10}
      >
        <Text style={styles.batalText}>{t("fe.batal")}</Text>
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
    btnTerang: {
      marginTop: 16,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    btnTerangText: { fontSize: 13, fontWeight: "700", color: "#fff" },

    batal: { position: "absolute", left: 20 },
    batalText: { fontSize: 16, fontWeight: "500", color: BIRU },

    introWrap: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 32,
    },
    introIkon: {
      width: 200,
      height: 200,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 40,
    },
    introJudul: {
      fontSize: 20,
      fontWeight: "700",
      color: PUTIH,
      textAlign: "center",
      marginTop: 40,
    },
    introIsi: {
      fontSize: 14.5,
      lineHeight: 21,
      color: PUTIH,
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
    galat: {
      fontSize: 13,
      lineHeight: 19,
      color: "#FF6961",
      textAlign: "center",
      marginTop: 14,
      maxWidth: 320,
    },
    btnBiru: {
      alignSelf: "stretch",
      height: 52,
      borderRadius: 14,
      backgroundColor: BIRU,
      alignItems: "center",
      justifyContent: "center",
    },
    btnBiruText: { fontSize: 16, fontWeight: "600", color: PUTIH },
    cekRow: { flexDirection: "row", alignItems: "center", gap: 10 },

    teksBawah: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      paddingHorizontal: 32,
    },
    instruksi: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "600",
      color: PUTIH,
      textAlign: "center",
      maxWidth: 300,
    },
    petunjuk: {
      fontSize: 13,
      color: REDUP,
      textAlign: "center",
      marginTop: 8,
    },

    bingkai: { position: "absolute" },
    sudut: {
      position: "absolute",
      width: 46,
      height: 46,
      borderColor: PUTIH,
    },
    sudutKiriAtas: {
      left: 0,
      top: 0,
      borderLeftWidth: 4,
      borderTopWidth: 4,
      borderTopLeftRadius: 22,
    },
    sudutKananAtas: {
      right: 0,
      top: 0,
      borderRightWidth: 4,
      borderTopWidth: 4,
      borderTopRightRadius: 22,
    },
    sudutKiriBawah: {
      left: 0,
      bottom: 0,
      borderLeftWidth: 4,
      borderBottomWidth: 4,
      borderBottomLeftRadius: 22,
    },
    sudutKananBawah: {
      right: 0,
      bottom: 0,
      borderRightWidth: 4,
      borderBottomWidth: 4,
      borderBottomRightRadius: 22,
    },

    pitaH: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 40,
    },
    pitaV: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width: 40,
    },
  });
