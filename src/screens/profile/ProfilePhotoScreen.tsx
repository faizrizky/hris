import { holdLock } from "@/services/biometric";
import type { ScreenProps } from "@/navigation/types";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView as RNScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Palette,
  secondaryButtonStyle,
  primaryButtonStyle,
} from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { goBackAnimated } from "@/navigation/navigationBack";
import { saveAttachment } from "@/utils/attachment";
import { toJpeg } from "@/utils/toJpeg";
import { initialsOf } from "@/utils/ProfileCompleteness";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";
import { getFaceEmbedding, isFaceSupported } from "@/services/faceCheck";
import { Head, type HeadVariant } from "./HeadIllustration";

const SLIDES: { title: string; content: string; headVariant: HeadVariant }[] = [
  { title: "pf.t1", content: "pf.t1Isi", headVariant: "gelap" },
  { title: "pf.t2", content: "pf.t2Isi", headVariant: "menoleh" },
  { title: "pf.t3", content: "pf.t3Isi", headVariant: "kacamata" },
];

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

type UpdateStage = "panduan" | "pilih" | "tinjau" | "selesai";

// Ganti foto profil: panduan (slide), pilih/ambil foto, tinjau, lalu ajukan
// ke HR. Sebelum dikirim, kemiripannya dengan wajah terdaftar dihitung dan
// karyawan diperingatkan bila rendah.
export function ProfilePhotoScreen({ navigation }: ScreenProps) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const now = useProfilePhoto();
  const [stage, setStage] = useState<UpdateStage>("panduan");
  const [baru, setBaru] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Setiap ganti tahap, isi memudar masuk sambil naik sedikit.
  const [appear] = useState(() => new Animated.Value(1));
  const goToStep = (next: UpdateStage) => {
    setErrorMessage(null);
    setStage(next);
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 320,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  };

  const pick = async (isFromCamera: boolean) => {
    setErrorMessage(null);
    const permission = isFromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage(t("pf.izin"));
      return;
    }
    holdLock();
    const launchPicker = isFromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
    const r = await launchPicker({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
      cameraType: ImagePicker.CameraType.front,
    });
    if (r.canceled) return;
    try {
      setBaru(await toJpeg(r.assets[0]!.uri));
      goToStep("tinjau");
    } catch {
      setErrorMessage(t("pf.formatGagal"));
    }
  };

  const submitRequest = async () => {
    if (!baru) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const faceEmbedding = await getFaceEmbedding(baru);
      if (!faceEmbedding) {
        setErrorMessage(t("pf.tanpaWajah"));
        return;
      }
      const status = await hrisApi.getFaceStatus();
      let idCardEmbedding: number[] | undefined;
      if (status.ktpUrl) {
        try {
          const k = await getFaceEmbedding(
            await saveAttachment(status.ktpUrl, "ktp"),
          );
          if (k) idCardEmbedding = k;
        } catch {
          // pembanding KTP opsional
        }
      }
      const checkResult = await hrisApi.submitProfilePhoto({
        embedding: faceEmbedding,
        ktpEmbedding: idCardEmbedding,
        dryRun: true,
      });
      if (checkResult.belowMin) {
        const isConfirmed = await confirm({
          title: t("pf.rendahJudul"),
          message: t("pf.rendahPesan"),
          tone: "warn",
          confirmText: t("pf.tetapAjukan"),
          cancelText: t("pf.pilihLain"),
        });
        if (!isConfirmed) return;
      }
      await hrisApi.submitProfilePhoto({
        photo: { uri: baru, name: "profil.jpg", mimeType: "image/jpeg" },
        embedding: faceEmbedding,
        ktpEmbedding: idCardEmbedding,
      });
      goToStep("selesai");
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsBusy(false);
    }
  };

  const stepBack = () => {
    if (stage === "tinjau") goToStep("pilih");
    else if (stage === "pilih") goToStep("panduan");
    else goBackAnimated(navigation);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={stepBack}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle}>{t("pf.judul")}</Text>
        <Text style={styles.headerSub}>{t("pf.sub")}</Text>
      </View>
      {stage === "panduan" ? (
        <Pressable onPress={() => goToStep("pilih")} hitSlop={10}>
          <Text style={styles.skip}>{t("pf.lewati")}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const styleVariant = {
    flex: 1,
    opacity: appear,
    transform: [
      {
        translateY: appear.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      {header}
      <Animated.View style={styleVariant}>
        {stage === "panduan" ? (
          <Guide
            onDone={() => goToStep("pilih")}
            styles={styles}
            c={c}
            bottom={insets.bottom}
          />
        ) : stage === "pilih" ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.card, { alignItems: "center" }]}>
              <View style={styles.currentWrap}>
                {now ? (
                  <Image source={{ uri: now }} style={styles.currentImg} />
                ) : (
                  <LinearGradient
                    colors={[c.accent, c.accent2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.currentImg}
                  >
                    <Text style={styles.currentInitial}>
                      {initialsOf(employee?.fullName ?? "")}
                    </Text>
                  </LinearGradient>
                )}
                <View style={styles.camBadge}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              </View>
              <Text style={styles.pickTitle}>
                {now ? t("pf.fotoSekarang") : t("pf.belumAdaFoto")}
              </Text>
              <Text style={styles.pickSubtitle}>{t("pf.pilihSub")}</Text>
            </View>

            {errorMessage ? (
              <ErrorBox text={errorMessage} styles={styles} c={c} />
            ) : null}

            <Button
              label={t("pf.bukaKamera")}
              icon="camera-outline"
              onPress={() => pick(true)}
              styles={styles}
              c={c}
            />
            <Pressable style={styles.secondary} onPress={() => pick(false)}>
              <Ionicons name="images-outline" size={17} color={c.accent} />
              <Text style={styles.secondaryText}>{t("pf.galeri")}</Text>
            </Pressable>
          </ScrollView>
        ) : stage === "tinjau" && baru ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <View style={styles.preview}>
                <Image source={{ uri: baru }} style={styles.previewImg} />
                <View style={styles.previewTag}>
                  <Text style={styles.previewTagText}>{t("pf.baru")}</Text>
                </View>
              </View>
              <View style={styles.compareRow}>
                <View style={styles.miniWrap}>
                  {now ? (
                    <Image source={{ uri: now }} style={styles.mini} />
                  ) : (
                    <LinearGradient
                      colors={[c.accent, c.accent2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.mini}
                    >
                      <Text style={styles.miniText}>
                        {initialsOf(employee?.fullName ?? "")}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.compareTitle}>{t("pf.sekarang")}</Text>
                  <Text style={styles.compareSub}>{t("pf.gantiKeBaru")}</Text>
                </View>
              </View>
            </View>

            {errorMessage || !isFaceSupported() ? (
              <ErrorBox
                text={errorMessage ?? t("face.tidakDidukung")}
                styles={styles}
                c={c}
              />
            ) : null}

            <Button
              label={isBusy ? t("umum.memproses") : t("pf.ajukan")}
              onPress={submitRequest}
              disabled={isBusy || !isFaceSupported()}
              styles={styles}
              c={c}
            />
            <Pressable
              style={styles.secondary}
              onPress={() => goToStep("pilih")}
              disabled={isBusy}
            >
              <Text style={styles.secondaryText}>{t("pf.ulang")}</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <EmptyState
              icon="M5 13l4 4L19 7"
              title={t("pf.terkirimJudul")}
              text={t("pf.terkirim")}
            >
              <Pressable
                style={styles.goBackButton}
                onPress={() => goBackAnimated(navigation)}
              >
                <Text style={styles.goBackText}>{t("pf.kembali")}</Text>
              </Pressable>
            </EmptyState>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// Panduan foto bergaya onboarding: slide geser, titik penanda, tombol Lanjut.
function Guide({
  onDone,
  styles,
  c,
  bottom,
}: {
  onDone: () => void;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
  bottom: number;
}) {
  const t = useT();
  const { width } = useWindowDimensions();
  const [slideValue] = useState(() => new Animated.Value(0));
  const pager = useRef<RNScrollView>(null);
  const [hal, setHal] = useState(0);
  const isLastSlide = hal === SLIDES.length - 1;

  // Ilustrasi slide pertama ikut "mengapung" pelan supaya halaman terasa hidup.
  const [floating] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floating, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floating, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floating]);

  const proceed = () => {
    if (isLastSlide) {
      onDone();
      return;
    }
    pager.current?.scrollTo({ x: (hal + 1) * width, animated: true });
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        ref={pager as never}
        style={{ flex: 1 }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: slideValue } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) =>
          setHal(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {SLIDES.map((s, i) => {
          const masuk = slideValue.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          });
          return (
            <View key={s.title} style={[styles.slide, { width }]}>
              <Animated.View
                style={[
                  styles.stage,
                  {
                    opacity: masuk,
                    transform: [
                      {
                        scale: masuk.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                        }),
                      },
                      {
                        translateY: floating.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -6],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={[c.info.bg, c.bg]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.exampleRow}>
                  <Head variant="benar" size={96} c={c} />
                  <Mark ok c={c} />
                </View>
                <View style={styles.exampleRow}>
                  <Head variant={s.headVariant} size={96} c={c} />
                  <Mark c={c} />
                </View>
              </Animated.View>
              <Animated.Text style={[styles.slideTitle, { opacity: masuk }]}>
                {t(s.title as never)}
              </Animated.Text>
              <Animated.Text style={[styles.slideText, { opacity: masuk }]}>
                {t(s.content as never)}
              </Animated.Text>
            </View>
          );
        })}
      </Animated.ScrollView>

      <View style={[styles.pagerBar, { paddingBottom: bottom + 20 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => {
            const dotProgress = slideValue.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0, 1, 0],
              extrapolate: "clamp",
            });
            return (
              <View key={s.title} style={styles.dotSlot}>
                <View style={styles.dot} />
                <Animated.View
                  style={[
                    styles.dot,
                    styles.dotOn,
                    StyleSheet.absoluteFill,
                    { opacity: dotProgress },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <Button
          label={isLastSlide ? t("pf.mulai") : t("pf.lanjut")}
          icon={isLastSlide ? "camera-outline" : undefined}
          onPress={proceed}
          styles={styles}
          c={c}
        />
      </View>
    </View>
  );
}

function Mark({ ok, c }: { ok?: boolean; c: Palette }) {
  const accentColor = ok ? c.ok.ink : c.bad.ink;
  return (
    <View
      style={{
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 3,
        borderColor: accentColor,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.card,
      }}
    >
      <Ionicons
        name={ok ? "checkmark" : "close"}
        size={28}
        color={accentColor}
      />
    </View>
  );
}

function ErrorBox({
  text,
  styles,
  c,
}: {
  text: string;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={17} color={c.bad.ink} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

function Button({
  label,
  icon,
  onPress,
  disabled,
  styles,
  c,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ marginTop: 16 }}>
      <LinearGradient
        colors={disabled ? [c.track, c.track] : [c.accent, c.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primary}
      >
        {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
        <Text style={styles.primaryText}>{label}</Text>
      </LinearGradient>
    </Pressable>
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
    headerSub: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },
    skip: { fontSize: 13, fontWeight: "700", color: c.accent },
    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },

    slide: { alignItems: "center", paddingHorizontal: 28, paddingTop: 24 },
    stage: {
      width: 270,
      height: 270,
      borderRadius: 135,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    exampleRow: { flexDirection: "row", alignItems: "center", gap: 18 },
    slideTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: c.ink,
      textAlign: "center",
      marginTop: 26,
    },
    slideText: {
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "500",
      color: c.muted,
      textAlign: "center",
      marginTop: 8,
      maxWidth: 300,
    },
    pagerBar: {
      paddingHorizontal: 18,
      paddingTop: 12,
      backgroundColor: c.bg,
    },
    dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
    dotSlot: { width: 8, height: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.track },
    dotOn: { backgroundColor: c.accent },

    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 18,
      marginBottom: 12,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },

    currentWrap: { width: 132, height: 132, marginTop: 4 },
    currentImg: {
      width: 132,
      height: 132,
      borderRadius: 66,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    currentInitial: { fontSize: 40, fontWeight: "800", color: "#fff" },
    camBadge: {
      position: "absolute",
      right: 4,
      bottom: 4,
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 3,
      borderColor: c.card,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    pickTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: c.ink,
      marginTop: 16,
      textAlign: "center",
    },
    pickSubtitle: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "500",
      color: c.muted,
      marginTop: 6,
      textAlign: "center",
    },

    preview: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: c.chip,
    },
    previewImg: { width: "100%", height: "100%" },
    previewTag: {
      position: "absolute",
      top: 12,
      left: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: c.accent,
    },
    previewTagText: { fontSize: 10.5, fontWeight: "700", color: "#fff" },
    compareRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 14,
    },
    miniWrap: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
    mini: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    miniText: { fontSize: 14, fontWeight: "800", color: "#fff" },
    compareTitle: { fontSize: 12.5, fontWeight: "700", color: c.ink },
    compareSub: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },

    errorBox: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.bad.bg,
    },
    errorText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "600",
      color: c.bad.ink,
    },

    primary: {
      ...primaryButtonStyle(c),
      flexDirection: "row",
      gap: 8,
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    secondary: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      ...secondaryButtonStyle(c),
    },
    secondaryText: { fontSize: 13.5, fontWeight: "700", color: c.btnSoftInk },

    goBackButton: {
      marginTop: 16,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    goBackText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
