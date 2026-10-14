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

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { kembali } from "@/navigation/kembali";
import { simpanLampiran } from "@/utils/lampiran";
import { jadikanJpeg } from "@/utils/jadikanJpeg";
import { inisial } from "@/utils/ProfileCompleteness";
import { useFotoProfil } from "@/hooks/useFotoProfil";
import { embeddingWajah, wajahDidukung } from "@/services/faceCheck";
import { Kepala, type VarianKepala } from "./KepalaIlustrasi";

const SLIDES: { judul: string; isi: string; salah: VarianKepala }[] = [
  { judul: "pf.t1", isi: "pf.t1Isi", salah: "gelap" },
  { judul: "pf.t2", isi: "pf.t2Isi", salah: "menoleh" },
  { judul: "pf.t3", isi: "pf.t3Isi", salah: "kacamata" },
];

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

type Tahap = "panduan" | "pilih" | "tinjau" | "selesai";

// Ganti foto profil: panduan (slide), pilih/ambil foto, tinjau, lalu ajukan
// ke HR. Sebelum dikirim, kemiripannya dengan wajah terdaftar dihitung dan
// karyawan diperingatkan bila rendah.
export function ProfilePhotoScreen({ navigation }: any) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const sekarang = useFotoProfil();
  const [tahap, setTahap] = useState<Tahap>("panduan");
  const [baru, setBaru] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Setiap ganti tahap, isi memudar masuk sambil naik sedikit.
  const [muncul] = useState(() => new Animated.Value(1));
  const keTahap = (next: Tahap) => {
    setGalat(null);
    setTahap(next);
    muncul.setValue(0);
    Animated.timing(muncul, {
      toValue: 1,
      duration: 320,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  };

  const pilih = async (kamera: boolean) => {
    setGalat(null);
    const izin = kamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      setGalat(t("pf.izin"));
      return;
    }
    const buka = kamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
    const r = await buka({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
      cameraType: ImagePicker.CameraType.front,
    });
    if (r.canceled) return;
    try {
      setBaru(await jadikanJpeg(r.assets[0]!.uri));
      keTahap("tinjau");
    } catch {
      setGalat(t("pf.formatGagal"));
    }
  };

  const ajukan = async () => {
    if (!baru) return;
    setSibuk(true);
    setGalat(null);
    try {
      const emb = await embeddingWajah(baru);
      if (!emb) {
        setGalat(t("pf.tanpaWajah"));
        return;
      }
      const status = await hrisApi.getFaceStatus();
      let ktpEmb: number[] | undefined;
      if (status.ktpUrl) {
        try {
          const k = await embeddingWajah(
            await simpanLampiran(status.ktpUrl, "ktp"),
          );
          if (k) ktpEmb = k;
        } catch {
          // pembanding KTP opsional
        }
      }
      const cek = await hrisApi.submitProfilePhoto({
        embedding: emb,
        ktpEmbedding: ktpEmb,
        dryRun: true,
      });
      if (cek.belowMin) {
        const lanjut = await confirm({
          title: t("pf.rendahJudul"),
          message: t("pf.rendahPesan"),
          tone: "warn",
          confirmText: t("pf.tetapAjukan"),
          cancelText: t("pf.pilihLain"),
        });
        if (!lanjut) return;
      }
      await hrisApi.submitProfilePhoto({
        photo: { uri: baru, name: "profil.jpg", mimeType: "image/jpeg" },
        embedding: emb,
        ktpEmbedding: ktpEmb,
      });
      keTahap("selesai");
    } catch (e) {
      setGalat(describeError(e));
    } finally {
      setSibuk(false);
    }
  };

  const mundur = () => {
    if (tahap === "tinjau") keTahap("pilih");
    else if (tahap === "pilih") keTahap("panduan");
    else kembali(navigation);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={mundur}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle}>{t("pf.judul")}</Text>
        <Text style={styles.headerSub}>{t("pf.sub")}</Text>
      </View>
      {tahap === "panduan" ? (
        <Pressable onPress={() => keTahap("pilih")} hitSlop={10}>
          <Text style={styles.skip}>{t("pf.lewati")}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const gaya = {
    flex: 1,
    opacity: muncul,
    transform: [
      {
        translateY: muncul.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      {header}
      <Animated.View style={gaya}>
        {tahap === "panduan" ? (
          <Panduan
            onSelesai={() => keTahap("pilih")}
            styles={styles}
            c={c}
            bawah={insets.bottom}
          />
        ) : tahap === "pilih" ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.card, { alignItems: "center" }]}>
              <View style={styles.currentWrap}>
                {sekarang ? (
                  <Image source={{ uri: sekarang }} style={styles.currentImg} />
                ) : (
                  <LinearGradient
                    colors={[c.accent, c.accent2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.currentImg}
                  >
                    <Text style={styles.currentInitial}>
                      {inisial(employee?.fullName ?? "")}
                    </Text>
                  </LinearGradient>
                )}
                <View style={styles.camBadge}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              </View>
              <Text style={styles.pilihTitle}>
                {sekarang ? t("pf.fotoSekarang") : t("pf.belumAdaFoto")}
              </Text>
              <Text style={styles.pilihSub}>{t("pf.pilihSub")}</Text>
            </View>

            {galat ? <GalatBox teks={galat} styles={styles} c={c} /> : null}

            <Tombol
              label={t("pf.bukaKamera")}
              icon="camera-outline"
              onPress={() => pilih(true)}
              styles={styles}
              c={c}
            />
            <Pressable style={styles.secondary} onPress={() => pilih(false)}>
              <Ionicons name="images-outline" size={17} color={c.accent} />
              <Text style={styles.secondaryText}>{t("pf.galeri")}</Text>
            </Pressable>
          </ScrollView>
        ) : tahap === "tinjau" && baru ? (
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
                  {sekarang ? (
                    <Image source={{ uri: sekarang }} style={styles.mini} />
                  ) : (
                    <LinearGradient
                      colors={[c.accent, c.accent2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.mini}
                    >
                      <Text style={styles.miniText}>
                        {inisial(employee?.fullName ?? "")}
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

            {galat || !wajahDidukung() ? (
              <GalatBox
                teks={galat ?? t("face.tidakDidukung")}
                styles={styles}
                c={c}
              />
            ) : null}

            <Tombol
              label={sibuk ? t("umum.memproses") : t("pf.ajukan")}
              onPress={ajukan}
              disabled={sibuk || !wajahDidukung()}
              styles={styles}
              c={c}
            />
            <Pressable
              style={styles.secondary}
              onPress={() => keTahap("pilih")}
              disabled={sibuk}
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
                style={styles.kembaliBtn}
                onPress={() => kembali(navigation)}
              >
                <Text style={styles.kembaliText}>{t("pf.kembali")}</Text>
              </Pressable>
            </EmptyState>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// Panduan foto bergaya onboarding: slide geser, titik penanda, tombol Lanjut.
function Panduan({
  onSelesai,
  styles,
  c,
  bawah,
}: {
  onSelesai: () => void;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
  bawah: number;
}) {
  const t = useT();
  const { width } = useWindowDimensions();
  const [geser] = useState(() => new Animated.Value(0));
  const pager = useRef<RNScrollView>(null);
  const [hal, setHal] = useState(0);
  const terakhir = hal === SLIDES.length - 1;

  // Ilustrasi slide pertama ikut "mengapung" pelan supaya halaman terasa hidup.
  const [apung] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(apung, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(apung, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [apung]);

  const lanjut = () => {
    if (terakhir) {
      onSelesai();
      return;
    }
    pager.current?.scrollTo({ x: (hal + 1) * width, animated: true });
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        ref={pager as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: geser } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) =>
          setHal(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {SLIDES.map((s, i) => {
          const masuk = geser.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          });
          return (
            <View key={s.judul} style={[styles.slide, { width }]}>
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
                        translateY: apung.interpolate({
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
                  <Kepala varian="benar" ukuran={96} c={c} />
                  <Tanda ok c={c} />
                </View>
                <View style={styles.exampleRow}>
                  <Kepala varian={s.salah} ukuran={96} c={c} />
                  <Tanda c={c} />
                </View>
              </Animated.View>
              <Animated.Text style={[styles.slideTitle, { opacity: masuk }]}>
                {t(s.judul as never)}
              </Animated.Text>
              <Animated.Text style={[styles.slideText, { opacity: masuk }]}>
                {t(s.isi as never)}
              </Animated.Text>
            </View>
          );
        })}
      </Animated.ScrollView>

      <View style={[styles.pagerBar, { paddingBottom: bawah + 110 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => {
            const aktif = geser.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0, 1, 0],
              extrapolate: "clamp",
            });
            return (
              <View key={s.judul} style={styles.dotSlot}>
                <View style={styles.dot} />
                <Animated.View
                  style={[
                    styles.dot,
                    styles.dotOn,
                    StyleSheet.absoluteFill,
                    { opacity: aktif },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <Tombol
          label={terakhir ? t("pf.mulai") : t("pf.lanjut")}
          icon={terakhir ? "camera-outline" : undefined}
          onPress={lanjut}
          styles={styles}
          c={c}
        />
      </View>
    </View>
  );
}

function Tanda({ ok, c }: { ok?: boolean; c: Palette }) {
  const warna = ok ? c.ok.ink : c.bad.ink;
  return (
    <View
      style={{
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 3,
        borderColor: warna,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.card,
      }}
    >
      <Ionicons name={ok ? "checkmark" : "close"} size={28} color={warna} />
    </View>
  );
}

function GalatBox({
  teks,
  styles,
  c,
}: {
  teks: string;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}) {
  return (
    <View style={styles.galatBox}>
      <Ionicons name="alert-circle" size={17} color={c.bad.ink} />
      <Text style={styles.galatText}>{teks}</Text>
    </View>
  );
}

function Tombol({
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
    // Ruang bawah untuk floating tab bar.
    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 140 },

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
    pagerBar: { paddingHorizontal: 18 },
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
    pilihTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: c.ink,
      marginTop: 16,
      textAlign: "center",
    },
    pilihSub: {
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

    galatBox: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.bad.bg,
    },
    galatText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "600",
      color: c.bad.ink,
    },

    primary: {
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
      backgroundColor: c.chip,
    },
    secondaryText: { fontSize: 13.5, fontWeight: "700", color: c.accent },

    kembaliBtn: {
      marginTop: 16,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    kembaliText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
