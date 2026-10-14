import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
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
import { inisial } from "@/utils/ProfileCompleteness";
import { embeddingWajah, wajahDidukung } from "@/services/faceCheck";
import type { FaceStatus } from "@/services/types";

const PANDUAN = ["pf.p1", "pf.p2", "pf.p3"] as const;

// Ganti foto profil: diajukan ke HR. Sebelum dikirim, kemiripannya dengan wajah
// terdaftar dihitung dan karyawan diperingatkan bila rendah.
export function ProfilePhotoScreen({ navigation }: any) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [sekarang, setSekarang] = useState<string | null>(null);
  const [baru, setBaru] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [selesai, setSelesai] = useState(false);

  useEffect(() => {
    hrisApi
      .getFaceStatus()
      .then(async (s) => {
        setStatus(s);
        if (s.profileUrl)
          setSekarang(await simpanLampiran(s.profileUrl, "profil"));
      })
      .catch((e) => setGalat(describeError(e)));
  }, []);

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
    if (!r.canceled) setBaru(r.assets[0]!.uri);
  };

  const ajukan = async () => {
    if (!baru || !status) return;
    setSibuk(true);
    setGalat(null);
    try {
      const emb = await embeddingWajah(baru);
      if (!emb) {
        setGalat(t("pf.tanpaWajah"));
        return;
      }
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
      setSelesai(true);
    } catch (e) {
      setGalat(describeError(e));
    } finally {
      setSibuk(false);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle}>{t("pf.judul")}</Text>
        <Text style={styles.headerSub}>{t("pf.sub")}</Text>
      </View>
    </View>
  );

  if (selesai) {
    return (
      <View style={styles.container}>
        {header}
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
      </View>
    );
  }

  const bisa = !!baru && !sibuk && wajahDidukung();
  const nama = employee?.fullName ?? "";

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.compare}>
            <Bingkai
              uri={sekarang}
              label={t("pf.sekarang")}
              awal={inisial(nama)}
              styles={styles}
              c={c}
            />
            <View style={styles.arrow}>
              <Ionicons name="arrow-forward" size={16} color={c.accent} />
            </View>
            <Bingkai
              uri={baru}
              label={t("pf.baru")}
              aktif
              styles={styles}
              c={c}
            />
          </View>
          <View style={styles.pilihRow}>
            <Pressable style={styles.pilihBtn} onPress={() => pilih(true)}>
              <View style={[styles.pilihIcon, { backgroundColor: c.info.bg }]}>
                <Ionicons name="camera-outline" size={18} color={c.info.ink} />
              </View>
              <Text style={styles.pilihText}>{t("pf.kamera")}</Text>
            </Pressable>
            <Pressable style={styles.pilihBtn} onPress={() => pilih(false)}>
              <View style={[styles.pilihIcon, { backgroundColor: c.ok.bg }]}>
                <Ionicons name="images-outline" size={18} color={c.ok.ink} />
              </View>
              <Text style={styles.pilihText}>{t("pf.galeri")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("pf.panduan")}</Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            {PANDUAN.map((k) => (
              <View key={k} style={styles.guideRow}>
                <Ionicons name="checkmark-circle" size={17} color={c.ok.ink} />
                <Text style={styles.guideText}>{t(k)}</Text>
              </View>
            ))}
          </View>
          {status?.state === "active" || status?.state === "needs_reenroll" ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>{t("pf.catatanWajah")}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <Text
          style={[
            styles.barText,
            (galat || !wajahDidukung()) && { color: c.bad.ink },
          ]}
          numberOfLines={3}
        >
          {galat ??
            (!wajahDidukung()
              ? t("face.tidakDidukung")
              : baru
                ? t("pf.siap")
                : t("pf.belumPilih"))}
        </Text>
        <Pressable onPress={ajukan} disabled={!bisa}>
          <LinearGradient
            colors={bisa ? [c.accent, c.accent2] : [c.track, c.track]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submit}
          >
            <Text style={[styles.submitText, bisa && { color: "#fff" }]}>
              {sibuk ? t("umum.memproses") : t("pf.ajukan")}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Bingkai({
  uri,
  label,
  awal,
  aktif,
  styles,
  c,
}: {
  uri: string | null;
  label: string;
  awal?: string;
  aktif?: boolean;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View style={[styles.frame, aktif && !uri && styles.frameKosong]}>
        {uri ? (
          <Image source={{ uri }} style={styles.foto} />
        ) : awal ? (
          <LinearGradient
            colors={[c.accent, c.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.foto}
          >
            <Text style={styles.awal}>{awal}</Text>
          </LinearGradient>
        ) : (
          <Ionicons name="add" size={28} color={c.mutedLabel} />
        )}
      </View>
      <Text style={styles.frameLabel}>{label}</Text>
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
    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },

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
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },

    compare: { flexDirection: "row", alignItems: "center", gap: 10 },
    arrow: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
    },
    frame: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    frameKosong: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.fieldBorder,
      backgroundColor: c.card,
    },
    foto: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    awal: { fontSize: 30, fontWeight: "800", color: "#fff" },
    frameLabel: {
      fontSize: 11.5,
      fontWeight: "600",
      color: c.muted,
      marginTop: 8,
    },

    pilihRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    pilihBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.fieldBorder,
    },
    pilihIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    pilihText: { fontSize: 12.5, fontWeight: "600", color: c.ink },

    guideRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    guideText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "500",
      color: c.ink,
    },
    note: {
      marginTop: 14,
      padding: 12,
      borderRadius: 14,
      backgroundColor: c.warn.bg,
    },
    noteText: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "600",
      color: c.warn.ink,
    },

    actionBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.hair,
      paddingHorizontal: 18,
      paddingTop: 12,
    },
    barText: { flex: 1, fontSize: 11.5, fontWeight: "600", color: c.muted },
    submit: {
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderRadius: 16,
      alignItems: "center",
    },
    submitText: { fontSize: 13, fontWeight: "700", color: c.mutedLabel },

    kembaliBtn: {
      marginTop: 16,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    kembaliText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
