import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import type { FaceReview } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useConfirm } from "@/components/ConfirmDialog";
import { ICON } from "@/constants/icons";
import { useT } from "@/i18n";
import { kembali } from "@/navigation/kembali";
import { bukaLampiran, simpanLampiran } from "@/utils/lampiran";

// HR: tinjau pendaftaran wajah yang menunggu (selfie, KTP, foto profil, skor kemiripan) lalu setujui atau tolak.
export function FaceReviewScreen({ navigation }: any) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();
  const daftar = useLoad(() => hrisApi.getFaceEnrollmentsForReview(), "wajah");
  const items = daftar.data ?? [];

  const [tolak, setTolak] = useState<FaceReview | null>(null);
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const keputusan = async (
    f: FaceReview,
    d: "approve" | "reject",
    catatan?: string,
  ) => {
    setSibuk(f.name);
    setGalat(null);
    try {
      await hrisApi.decideFaceEnrollment(f.name, d, catatan);
      daftar.ulangi();
    } catch (e) {
      setGalat(describeError(e));
    } finally {
      setSibuk(null);
    }
  };

  const setujui = async (f: FaceReview) => {
    const ya = await confirm({
      title: t("fr.setujuiJudul"),
      message: t("fr.setujuiPesan", { nama: f.employeeName }),
      tone: "info",
      confirmText: t("fr.setujui"),
      cancelText: t("umum.batal"),
    });
    if (ya) await keputusan(f, "approve");
  };

  const kirimTolak = async () => {
    if (!tolak) return;
    if (!alasan.trim()) return setGalat(t("fr.alasanWajib"));
    const f = tolak;
    setTolak(null);
    await keputusan(f, "reject", alasan.trim());
    setAlasan("");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>{t("fr.judul")}</Text>
          <Text style={styles.headerSub}>{t("fr.sub")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {galat ? <Text style={styles.galat}>{galat}</Text> : null}
        {daftar.error && !daftar.data ? (
          <ErrorState pesan={daftar.error} onUlangi={daftar.ulangi} />
        ) : daftar.memuat ? (
          <Skeleton width="100%" height={220} radius={22} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ICON.shield}
            title={t("fr.kosongJudul")}
            text={t("fr.kosongIsi")}
          />
        ) : (
          items.map((f) => (
            <Kartu
              key={f.name}
              f={f}
              sibuk={sibuk === f.name}
              onSetujui={() => setujui(f)}
              onTolak={() => {
                setAlasan("");
                setGalat(null);
                setTolak(f);
              }}
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={!!tolak}
        transparent
        animationType="fade"
        onRequestClose={() => setTolak(null)}
      >
        <View style={styles.modalLatar}>
          <View style={styles.modalKartu}>
            <Text style={styles.judulKartu}>{t("fr.tolakJudul")}</Text>
            <Text style={styles.meta}>{tolak?.employeeName}</Text>
            <TextInput
              style={styles.input}
              value={alasan}
              onChangeText={setAlasan}
              placeholder={t("fr.alasan")}
              placeholderTextColor={c.mutedLabel}
              multiline
            />
            {galat ? <Text style={styles.galat}>{galat}</Text> : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                style={[styles.tombol, { backgroundColor: c.chip }]}
                onPress={() => setTolak(null)}
              >
                <Text style={[styles.tombolText, { color: c.ink }]}>
                  {t("umum.batal")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tombol, { backgroundColor: c.bad.ink }]}
                onPress={kirimTolak}
              >
                <Text style={[styles.tombolText, { color: "#fff" }]}>
                  {t("fr.tolak")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Kartu({
  f,
  sibuk,
  onSetujui,
  onTolak,
}: {
  f: FaceReview;
  sibuk: boolean;
  onSetujui: () => void;
  onTolak: () => void;
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const skor = (label: string, v: number | null, min?: number) => {
    if (v === null || v === undefined) return null;
    const rendah = min !== undefined && v < min;
    return (
      <View
        key={label}
        style={[styles.skor, { borderColor: rendah ? c.bad.ink : c.ok.ink }]}
      >
        <Text
          style={[styles.skorText, { color: rendah ? c.bad.ink : c.ok.ink }]}
        >
          {label}: {Math.round(v * 10) / 10}%
          {min !== undefined ? `  (${t("fr.min", { n: min })})` : ""}
        </Text>
      </View>
    );
  };
  const spoofRendah = f.spoofMean !== null && f.spoofMean < 0.75;
  return (
    <View style={styles.kartu}>
      <Text style={styles.judulKartu}>{f.employeeName}</Text>
      <Text style={styles.meta}>
        {f.employee} · {f.created.slice(0, 16).replace("T", " ")}
      </Text>
      <View style={styles.fotoRow}>
        <Foto url={f.selfieUrl} label={t("fr.selfie")} />
        <Foto url={f.ktpUrl} label={t("fr.ktp")} />
        <Foto url={f.profileUrl} label={t("fr.profil")} />
      </View>
      <View style={{ gap: 6, marginTop: 12 }}>
        {skor(t("fr.skorKtp"), f.scoreKtp, f.minKtp)}
        {skor(t("fr.skorProfil"), f.scoreProfile, f.minProfile)}
        {skor(t("fr.skorProfilKtp"), f.scoreProfileKtp, f.minKtp)}
        {f.spoofMean !== null ? (
          <View
            style={[
              styles.skor,
              { borderColor: spoofRendah ? c.warn.ink : c.ok.ink },
            ]}
          >
            <Text
              style={[
                styles.skorText,
                { color: spoofRendah ? c.warn.ink : c.ok.ink },
              ]}
            >
              {t("fr.spoof", { n: f.spoofMean.toFixed(2) })}
              {spoofRendah ? `  (${t("fr.spoofRendah")})` : ""}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Pressable
          style={[styles.tombol, { backgroundColor: c.chip }]}
          onPress={onTolak}
          disabled={sibuk}
        >
          <Text style={[styles.tombolText, { color: c.bad.ink }]}>
            {t("fr.tolak")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tombol, { backgroundColor: c.accent }]}
          onPress={onSetujui}
          disabled={sibuk}
        >
          {sibuk ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.tombolText, { color: "#fff" }]}>
              {t("fr.setujui")}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// Foto privat: diunduh dengan sesi aplikasi. Gambar tampil langsung; PDF (mis. KTP hasil pindai) berupa tombol buka.
function Foto({ url, label }: { url: string | null; label: string }) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const pdf = !!url && /\.pdf($|\?)/i.test(url);
  const [uri, setUri] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);
  useEffect(() => {
    if (!url || pdf) return;
    let batal = false;
    simpanLampiran(url, `wajah-${label}`)
      .then((u) => !batal && setUri(u))
      .catch(() => !batal && setGagal(true));
    return () => {
      batal = true;
    };
  }, [url, pdf, label]);
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Pressable
        style={styles.fotoKotak}
        disabled={!url}
        onPress={() => url && bukaLampiran(url, label).catch(() => {})}
      >
        {!url ? (
          <Text style={styles.fotoKosong}>{t("fr.tanpaFoto")}</Text>
        ) : pdf ? (
          <View style={{ alignItems: "center", gap: 4 }}>
            <Ionicons name="document-text-outline" size={26} color={c.accent} />
            <Text style={styles.fotoKosong}>{t("fr.buka")}</Text>
          </View>
        ) : uri ? (
          <Image source={{ uri }} style={styles.foto} resizeMode="cover" />
        ) : gagal ? (
          <Text style={styles.fotoKosong}>{t("fr.tanpaFoto")}</Text>
        ) : (
          <ActivityIndicator color={c.accent} />
        )}
      </Pressable>
      <Text style={styles.fotoLabel}>{label}</Text>
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
      paddingBottom: 14,
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
    list: { paddingHorizontal: 18, paddingBottom: 140, gap: 12 },
    kartu: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
    },
    judulKartu: { fontSize: 14, fontWeight: "700", color: c.ink },
    meta: { fontSize: 11, color: c.muted, marginTop: 3 },
    fotoRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    fotoKotak: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 14,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    foto: { width: "100%", height: "100%" },
    fotoKosong: { fontSize: 10.5, fontWeight: "600", color: c.muted },
    fotoLabel: { fontSize: 11, fontWeight: "600", color: c.ink, marginTop: 6 },
    skor: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    skorText: { fontSize: 12, fontWeight: "700" },
    tombol: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      paddingVertical: 13,
    },
    tombolText: { fontSize: 13, fontWeight: "700" },
    galat: { fontSize: 12, color: c.bad.ink, fontWeight: "600" },
    modalLatar: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalKartu: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: c.card,
      borderRadius: 22,
      padding: 20,
    },
    input: {
      marginTop: 12,
      minHeight: 80,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: c.ink,
      textAlignVertical: "top",
    },
  });
