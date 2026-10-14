import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";
import { kembali } from "@/navigation/kembali";
import { simpanLampiran } from "@/utils/lampiran";
import { embeddingWajah, wajahDidukung } from "@/services/faceCheck";
import type { FaceStatus } from "@/services/types";

// Ganti foto profil: diajukan ke HR. Sebelum dikirim, kemiripannya dengan wajah
// terdaftar dihitung dan karyawan diperingatkan bila rendah.
export function ProfilePhotoScreen({ navigation }: any) {
  const t = useT();
  const confirm = useConfirm();
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
    const r = await (
      kamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync
    )({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("pf.judul")}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {selesai ? (
          <View style={styles.info}>
            <Text style={styles.infoText}>{t("pf.terkirim")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <Kotak uri={sekarang} label={t("pf.sekarang")} c={c} />
              <Kotak uri={baru} label={t("pf.baru")} c={c} />
            </View>
            <Text style={styles.petunjuk}>{t("pf.petunjuk")}</Text>
            {!wajahDidukung() ? (
              <Text style={styles.galat}>{t("face.tidakDidukung")}</Text>
            ) : null}
            {galat ? <Text style={styles.galat}>{galat}</Text> : null}
            <View style={styles.row}>
              <Pressable style={styles.sekunder} onPress={() => pilih(true)}>
                <Text style={styles.sekunderText}>{t("pf.kamera")}</Text>
              </Pressable>
              <Pressable style={styles.sekunder} onPress={() => pilih(false)}>
                <Text style={styles.sekunderText}>{t("pf.galeri")}</Text>
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.btn,
                (!baru || sibuk) && { backgroundColor: c.track },
              ]}
              onPress={ajukan}
              disabled={!baru || sibuk || !wajahDidukung()}
            >
              <Text style={styles.btnText}>
                {sibuk ? t("umum.memproses") : t("pf.ajukan")}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Kotak({
  uri,
  label,
  c,
}: {
  uri: string | null;
  label: string;
  c: Palette;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View
        style={{
          width: "100%",
          aspectRatio: 3 / 4,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: c.track,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Ionicons name="person" size={48} color={c.mutedLabel} />
        )}
      </View>
      <Text
        style={{ marginTop: 6, fontSize: 12, fontWeight: "600", color: c.ink }}
      >
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
    content: { padding: 18, gap: 14, paddingBottom: 40 },
    row: { flexDirection: "row", gap: 12 },
    petunjuk: { fontSize: 12, lineHeight: 18, color: c.muted },
    galat: { fontSize: 12, color: c.bad.ink },
    info: { backgroundColor: c.ok.bg, borderRadius: 14, padding: 14 },
    infoText: { fontSize: 13, fontWeight: "600", color: c.ok.ink },
    sekunder: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.fieldBorder,
    },
    sekunderText: { fontSize: 13, fontWeight: "600", color: c.ink },
    btn: {
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
      backgroundColor: c.accent,
    },
    btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  });
