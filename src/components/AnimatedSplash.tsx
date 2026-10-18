import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
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
  checkAndApplyOta,
  checkAppUpdate,
  UPDATE_MODE,
  downloadAndInstall,
  type UpdateInfo,
} from "@/services/appUpdate";
import { useT } from "@/i18n";

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const NAMA = "HRIS".split("");
const LOGO_SIZE = 120;
export const SPLASH_DURATION_MS = 2500;

type UpdateStage = "animasi" | "cek" | "ota" | "unduh" | "pasang" | "galat";

// Layar pembuka beranimasi, menyambung dari layar pembuka native (logo yang sama
// di tengah, latar putih): logo membesar dengan pegas, riak cahaya menyebar,
// huruf "HRIS" naik satu per satu, garis aksen tergambar, lalu seluruh layar
// memudar membuka aplikasi.
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [logo] = useState(() => new Animated.Value(0));
  const [ripple] = useState(() => new Animated.Value(0));
  const [letters] = useState(() => NAMA.map(() => new Animated.Value(0)));
  const [underline] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));
  const [exitFade] = useState(() => new Animated.Value(0));
  const [status] = useState(() => new Animated.Value(0));
  const [stage, setStage] = useState<UpdateStage>("animasi");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
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
        Animated.timing(ripple, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(380),
          Animated.stagger(
            90,
            letters.map((v) =>
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
          Animated.timing(underline, {
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
      Animated.delay(SPLASH_DURATION_MS - 1900),
    ]);
    anim.start(({ finished }) => {
      if (finished) setStage("cek");
    });
    return () => anim.stop();
  }, [underline, letters, logo, ripple, tagline]);

  const exitSplash = useCallback(() => {
    Animated.timing(exitFade, {
      toValue: 1,
      duration: 420,
      easing: EASE,
      useNativeDriver: true,
    }).start(() => onDone());
  }, [exitFade, onDone]);

  const startDownload = async (b: UpdateInfo) => {
    setProgress(0);
    setStage("unduh");
    try {
      await downloadAndInstall(b, setProgress);
      // Pemasang Android terbuka. Bila pengguna membatalkannya, layar ini menawarkan coba lagi.
      setStage("pasang");
    } catch {
      setStage("galat");
    }
  };

  // Setelah animasi selesai: periksa pembaruan. Pembaruan wajib menahan layar ini sampai terpasang.
  const isCheckingStage = stage === "cek";
  const handleExitSplash = useEffectEvent(exitSplash);
  const handleStartDownload = useEffectEvent(startDownload);
  useEffect(() => {
    if (!isCheckingStage) return;
    let isCancelled = false;
    status.setValue(0);
    Animated.timing(status, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
    (async () => {
      const baru = await checkAppUpdate();
      if (isCancelled) return;
      if (!baru || !baru.mandatory) {
        // Tidak ada APK baru: cek paket JavaScript (EAS Update); bila ada, aplikasi dimuat ulang sendiri.
        await checkAndApplyOta(() => setStage("ota"));
        handleExitSplash();
        return;
      }
      setUpdateInfo(baru);
      void handleStartDownload(baru);
    })();
    return () => {
      isCancelled = true;
    };
  }, [isCheckingStage, status]);

  const shouldShowStatus = stage !== "animasi";
  const statusLabel =
    stage === "cek"
      ? t("up.memeriksa")
      : stage === "ota"
        ? t("up.memperbarui")
        : stage === "unduh"
          ? t("up.mengunduh", {
              v: updateInfo?.versionName ?? "",
              p: Math.round(progress * 100),
            })
          : stage === "pasang"
            ? t("up.siapPasang")
            : stage === "galat"
              ? t("up.galat")
              : "";

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: exitFade.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
          transform: [
            {
              scale: exitFade.interpolate({
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

      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.ripple,
              {
                opacity: ripple.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, 0.35, 0],
                }),
                transform: [
                  {
                    scale: ripple.interpolate({
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
            <View style={styles.shadow}>
              <LogoHris size={LOGO_SIZE} />
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
                  opacity: letters[i],
                  transform: [
                    {
                      translateY: letters[i]!.interpolate({
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
            styles.underline,
            {
              transform: [{ scaleX: underline }],
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

      {shouldShowStatus ? (
        <Animated.View style={[styles.statusWrap, { opacity: status }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
          {stage === "unduh" ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(4, progress * 100)}%` },
                ]}
              />
            </View>
          ) : null}
          {updateInfo?.notes && (stage === "unduh" || stage === "pasang") ? (
            <Text style={styles.note} numberOfLines={3}>
              {updateInfo.notes}
            </Text>
          ) : null}
          {stage === "pasang" || stage === "galat" ? (
            <Pressable
              style={styles.button}
              onPress={() => updateInfo && startDownload(updateInfo)}
            >
              <Text style={styles.buttonText}>
                {t(
                  stage === "pasang"
                    ? UPDATE_MODE === "toko"
                      ? "up.bukaToko"
                      : "up.pasangLagi"
                    : "up.cobaLagi",
                )}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
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
    center: { alignItems: "center", marginTop: 124 },
    logoWrap: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    ripple: {
      position: "absolute",
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      borderRadius: LOGO_SIZE * 0.3,
      backgroundColor: c.accent,
    },
    shadow: {
      borderRadius: LOGO_SIZE * 0.225,
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
    underline: {
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
    progressTrack: {
      alignSelf: "stretch",
      height: 6,
      borderRadius: 3,
      backgroundColor: c.track,
      overflow: "hidden",
      marginTop: 12,
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
      backgroundColor: c.accent,
    },
    note: {
      fontSize: 11.5,
      lineHeight: 17,
      color: c.mutedLabel,
      textAlign: "center",
      marginTop: 12,
    },
    button: {
      marginTop: 14,
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    buttonText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
