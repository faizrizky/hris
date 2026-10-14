import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, Line, Path, Rect } from "react-native-svg";

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
import { inisial } from "@/utils/ProfileCompleteness";
import { useFotoProfil } from "@/hooks/useFotoProfil";
import { embeddingWajah, wajahDidukung } from "@/services/faceCheck";

const TIPS = [
  { judul: "pf.t1", isi: "pf.t1Isi" },
  { judul: "pf.t2", isi: "pf.t2Isi" },
  { judul: "pf.t3", isi: "pf.t3Isi" },
] as const;

type Tahap = "panduan" | "tinjau" | "selesai";

// Ganti foto profil: panduan dulu, lalu ambil/pilih foto, tinjau, dan ajukan
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
    setBaru(r.assets[0]!.uri);
    setTahap("tinjau");
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
      setTahap("selesai");
    } catch (e) {
      setGalat(describeError(e));
    } finally {
      setSibuk(false);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable
        style={styles.backBtn}
        onPress={() =>
          tahap === "tinjau" ? setTahap("panduan") : kembali(navigation)
        }
      >
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle}>{t("pf.judul")}</Text>
        <Text style={styles.headerSub}>{t("pf.sub")}</Text>
      </View>
    </View>
  );

  if (tahap === "selesai") {
    return (
      <View style={styles.container}>
        {header}
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
      </View>
    );
  }

  if (tahap === "tinjau" && baru) {
    return (
      <View style={styles.container}>
        {header}
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
            <View style={styles.galatBox}>
              <Ionicons name="alert-circle" size={17} color={c.bad.ink} />
              <Text style={styles.galatText}>
                {galat ?? t("face.tidakDidukung")}
              </Text>
            </View>
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
            onPress={() => setTahap("panduan")}
            disabled={sibuk}
          >
            <Text style={styles.secondaryText}>{t("pf.ulang")}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>{t("pf.panduanJudul")}</Text>
          <Text style={styles.introSub}>{t("pf.panduanSub")}</Text>
        </View>

        <View style={[styles.card, { alignItems: "center" }]}>
          <IlustrasiSelfie c={c} />
          <View style={styles.exampleRow}>
            <Contoh
              varian="benar"
              label={t("pf.cBenar")}
              c={c}
              styles={styles}
            />
            <Contoh
              varian="kacamata"
              label={t("pf.cKacamata")}
              c={c}
              styles={styles}
            />
            <Contoh
              varian="menoleh"
              label={t("pf.cMenoleh")}
              c={c}
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.card}>
          {TIPS.map((tip, i) => (
            <View
              key={tip.judul}
              style={[styles.tipRow, i > 0 && { marginTop: 16 }]}
            >
              <View style={styles.tipNum}>
                <Text style={styles.tipNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.tipTitle}>{t(tip.judul)}</Text>
                <Text style={styles.tipText}>{t(tip.isi)}</Text>
              </View>
            </View>
          ))}
        </View>

        {galat ? (
          <View style={styles.galatBox}>
            <Ionicons name="alert-circle" size={17} color={c.bad.ink} />
            <Text style={styles.galatText}>{galat}</Text>
          </View>
        ) : null}

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

// Sosok sederhana untuk ilustrasi: kepala, rambut, bahu.
function Sosok({
  c,
  ukuran,
  geser = 0,
  kacamata = false,
}: {
  c: Palette;
  ukuran: number;
  geser?: number;
  kacamata?: boolean;
}) {
  const kulit = "#F2C9A8";
  return (
    <Svg width={ukuran} height={ukuran} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={48} fill={c.info.bg} />
      <Path
        d="M18 100 C20 74 34 66 50 66 C66 66 80 74 82 100 Z"
        fill={c.accent}
      />
      <Ellipse cx={50 + geser} cy={44} rx={17} ry={20} fill={kulit} />
      <Path
        d={`M${33 + geser} 42 C${33 + geser} 24 ${67 + geser} 22 ${67 + geser} 40 C${60 + geser} 32 ${44 + geser} 33 ${33 + geser} 42 Z`}
        fill="#3B2A20"
      />
      {kacamata ? (
        <>
          <Rect
            x={38 + geser}
            y={42}
            width={10}
            height={7}
            rx={3}
            fill="#111"
          />
          <Rect
            x={52 + geser}
            y={42}
            width={10}
            height={7}
            rx={3}
            fill="#111"
          />
          <Line
            x1={48 + geser}
            y1={45}
            x2={52 + geser}
            y2={45}
            stroke="#111"
            strokeWidth={1.5}
          />
        </>
      ) : (
        <>
          <Circle cx={43 + geser} cy={46} r={1.8} fill="#3B2A20" />
          <Circle cx={57 + geser} cy={46} r={1.8} fill="#3B2A20" />
        </>
      )}
      <Path
        d={`M${45 + geser} 55 Q${50 + geser} 58 ${55 + geser} 55`}
        stroke="#A8664A"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function IlustrasiSelfie({ c }: { c: Palette }) {
  return (
    <View
      style={{
        width: 170,
        height: 170,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Sosok c={c} ukuran={130} />
      <Svg width={170} height={170} style={StyleSheet.absoluteFill}>
        <Line
          x1={85}
          y1={4}
          x2={85}
          y2={166}
          stroke={c.accent}
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
        <Line
          x1={4}
          y1={78}
          x2={166}
          y2={78}
          stroke={c.accent}
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
      </Svg>
    </View>
  );
}

function Contoh({
  varian,
  label,
  c,
  styles,
}: {
  varian: "benar" | "kacamata" | "menoleh";
  label: string;
  c: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const benar = varian === "benar";
  return (
    <View style={styles.example}>
      <View>
        <Sosok
          c={c}
          ukuran={58}
          kacamata={varian === "kacamata"}
          geser={varian === "menoleh" ? 9 : 0}
        />
        <View
          style={[
            styles.exampleBadge,
            { backgroundColor: benar ? c.ok.ink : c.bad.ink },
          ]}
        >
          <Ionicons
            name={benar ? "checkmark" : "close"}
            size={11}
            color="#fff"
          />
        </View>
      </View>
      <Text style={styles.exampleText} numberOfLines={2}>
        {label}
      </Text>
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
    headerSub: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },
    // Ruang bawah untuk floating tab bar.
    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 140 },

    intro: { alignItems: "center", paddingHorizontal: 12, marginBottom: 14 },
    introTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.ink,
      textAlign: "center",
    },
    introSub: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "500",
      color: c.muted,
      textAlign: "center",
      marginTop: 6,
    },

    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      marginBottom: 12,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },

    exampleRow: {
      flexDirection: "row",
      alignSelf: "stretch",
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    example: { flex: 1, alignItems: "center", gap: 8 },
    exampleBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.card,
      alignItems: "center",
      justifyContent: "center",
    },
    exampleText: {
      fontSize: 10.5,
      fontWeight: "600",
      color: c.muted,
      textAlign: "center",
    },

    tipRow: { flexDirection: "row", gap: 12 },
    tipNum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    tipNumText: { fontSize: 12, fontWeight: "800", color: "#fff" },
    tipTitle: { fontSize: 13, fontWeight: "700", color: c.ink },
    tipText: {
      fontSize: 11.5,
      lineHeight: 17,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
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
