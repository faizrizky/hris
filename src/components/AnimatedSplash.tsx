import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import { RadialGlow } from "@/components/RadialGlow";
import { LogoHris } from "@/components/LogoHris";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import {
  cekPembaruan,
  MODE_PEMBARUAN,
  unduhDanPasang,
  type InfoPembaruan,
} from "@/services/appUpdate";
import { useT } from "@/i18n";

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const NAMA = "HRIS".split("");
const UKURAN = 120;
export const DURASI_SPLASH_MS = 2500;

type Tahap = "animasi" | "cek" | "unduh" | "pasang" | "galat";

// Layar pembuka beranimasi, menyambung dari layar pembuka native (logo yang sama
// di tengah, latar putih): logo membesar dengan pegas, riak cahaya menyebar,
// huruf "HRIS" naik satu per satu, garis aksen tergambar, lalu seluruh layar
// memudar membuka aplikasi.
export function AnimatedSplash({ onSelesai }: { onSelesai: () => void }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [logo] = useState(() => new Animated.Value(0));
  const [riak] = useState(() => new Animated.Value(0));
  const [huruf] = useState(() => NAMA.map(() => new Animated.Value(0)));
  const [garis] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));
  const [keluar] = useState(() => new Animated.Value(0));
  const [status] = useState(() => new Animated.Value(0));
  const [tahap, setTahap] = useState<Tahap>("animasi");
  const [info, setInfo] = useState<InfoPembaruan | null>(null);
  const [progres, setProgres] = useState(0);
  const t = useT();

  useEffect(() => {
    // Layar native disembunyikan setelah layar ini siap, supaya tidak ada kedipan putih.
    SplashScreen.hideAsync().catch(() => {});
    const anim = Animated.sequence([
      Animated.parallel([
        Animated.spring(logo, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(riak, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(380),
          Animated.stagger(
            90,
            huruf.map((v) =>
              Animated.timing(v, {
                toValue: 1,
                duration: 480,
                easing: EASE,
                useNativeDriver: true,
              }),
            ),
          ),
        ]),
        Animated.sequence([
          Animated.delay(800),
          Animated.timing(garis, {
            toValue: 1,
            duration: 520,
            easing: EASE,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(950),
          Animated.timing(tagline, {
            toValue: 1,
            duration: 480,
            easing: EASE,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(DURASI_SPLASH_MS - 1900),
    ]);
    anim.start(({ finished }) => {
      if (finished) setTahap("cek");
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keluarSplash = useCallback(() => {
    Animated.timing(keluar, {
      toValue: 1,
      duration: 420,
      easing: EASE,
      useNativeDriver: true,
    }).start(() => onSelesai());
  }, [keluar, onSelesai]);

  const mulaiUnduh = async (b: InfoPembaruan) => {
    setProgres(0);
    setTahap("unduh");
    try {
      await unduhDanPasang(b, setProgres);
      // Pemasang Android terbuka. Bila pengguna membatalkannya, layar ini menawarkan coba lagi.
      setTahap("pasang");
    } catch {
      setTahap("galat");
    }
  };

  // Setelah animasi selesai: periksa pembaruan. Pembaruan wajib menahan layar ini sampai terpasang.
  useEffect(() => {
    if (tahap !== "cek") return;
    let batal = false;
    status.setValue(0);
    Animated.timing(status, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
    (async () => {
      const baru = await cekPembaruan();
      if (batal) return;
      if (!baru || !baru.mandatory) {
        keluarSplash();
        return;
      }
      setInfo(baru);
      void mulaiUnduh(baru);
    })();
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahap === "cek"]);

  const tampilStatus = tahap !== "animasi";
  const teksStatus =
    tahap === "cek"
      ? t("up.memeriksa")
      : tahap === "unduh"
        ? t("up.mengunduh", {
            v: info?.versionName ?? "",
            p: Math.round(progres * 100),
          })
        : tahap === "pasang"
          ? t("up.siapPasang")
          : tahap === "galat"
            ? t("up.galat")
            : "";

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: keluar.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
          transform: [
            {
              scale: keluar.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.05],
              }),
            },
          ],
        },
      ]}
      pointerEvents="auto"
    >
      <RadialGlow size={380} color={c.glowTop} top={-150} right={-110} />
      <RadialGlow size={340} color={c.glowBottom} bottom={-150} left={-120} />

      <View style={styles.tengah}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.riak,
              {
                opacity: riak.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, 0.35, 0],
                }),
                transform: [
                  {
                    scale: riak.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 2.6],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={{
              opacity: logo.interpolate({
                inputRange: [0, 0.3],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
              transform: [
                {
                  scale: logo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                },
              ],
            }}
          >
            <View style={styles.bayangan}>
              <LogoHris size={UKURAN} />
            </View>
          </Animated.View>
        </View>

        <View style={styles.namaRow}>
          {NAMA.map((h, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.nama,
                {
                  opacity: huruf[i],
                  transform: [
                    {
                      translateY: huruf[i]!.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {h}
            </Animated.Text>
          ))}
        </View>

        <Animated.View
          style={[
            styles.garis,
            {
              transform: [{ scaleX: garis }],
            },
          ]}
        >
          <LinearGradient
            colors={[c.accent, c.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: tagline,
              transform: [
                {
                  translateY: tagline.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Human Resource Information System
        </Animated.Text>
      </View>

      {tampilStatus ? (
        <Animated.View style={[styles.statusWrap, { opacity: status }]}>
          <Text style={styles.statusText}>{teksStatus}</Text>
          {tahap === "unduh" ? (
            <View style={styles.progresTrack}>
              <View
                style={[
                  styles.progresIsi,
                  { width: `${Math.max(4, progres * 100)}%` },
                ]}
              />
            </View>
          ) : null}
          {info?.notes && (tahap === "unduh" || tahap === "pasang") ? (
            <Text style={styles.catatan} numberOfLines={3}>
              {info.notes}
            </Text>
          ) : null}
          {tahap === "pasang" || tahap === "galat" ? (
            <Pressable
              style={styles.tombol}
              onPress={() => info && mulaiUnduh(info)}
            >
              <Text style={styles.tombolText}>
                {t(
                  tahap === "pasang"
                    ? MODE_PEMBARUAN === "toko"
                      ? "up.bukaToko"
                      : "up.pasangLagi"
                    : "up.cobaLagi",
                )}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.Text style={[styles.perusahaan, { opacity: tagline }]}>
        PT Falah Inovasi Teknologi
      </Animated.Text>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "#FFFFFF", // sama dengan layar pembuka native
      zIndex: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    // Grup digeser ke bawah setengah tinggi bagian di bawah logo, sehingga logo tepat di tengah layar
    // dan menyambung mulus dari layar pembuka native (logo yang sama di titik yang sama).
    tengah: { alignItems: "center", marginTop: 124 },
    logoWrap: {
      width: UKURAN,
      height: UKURAN,
      alignItems: "center",
      justifyContent: "center",
    },
    riak: {
      position: "absolute",
      width: UKURAN,
      height: UKURAN,
      borderRadius: UKURAN * 0.3,
      backgroundColor: c.accent,
    },
    bayangan: {
      borderRadius: UKURAN * 0.225,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 10,
    },
    namaRow: { flexDirection: "row", marginTop: 30, gap: 4 },
    nama: {
      fontSize: 40,
      fontWeight: "800",
      letterSpacing: 6,
      color: c.ink,
    },
    garis: {
      width: 56,
      height: 4,
      borderRadius: 2,
      overflow: "hidden",
      marginTop: 12,
    },
    tagline: {
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: 0.6,
      color: c.muted,
      marginTop: 14,
    },
    statusWrap: {
      position: "absolute",
      left: 32,
      right: 32,
      top: "50%",
      marginTop: 215,
      alignItems: "center",
    },
    statusText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.muted,
      textAlign: "center",
    },
    progresTrack: {
      alignSelf: "stretch",
      height: 6,
      borderRadius: 3,
      backgroundColor: c.track,
      overflow: "hidden",
      marginTop: 12,
    },
    progresIsi: { height: "100%", borderRadius: 3, backgroundColor: c.accent },
    catatan: {
      fontSize: 11.5,
      lineHeight: 17,
      color: c.mutedLabel,
      textAlign: "center",
      marginTop: 12,
    },
    tombol: {
      marginTop: 14,
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    tombolText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    perusahaan: {
      position: "absolute",
      bottom: 44,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1.2,
      color: c.mutedLabel,
    },
  });
