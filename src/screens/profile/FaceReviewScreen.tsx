import { useEffect, useMemo, useState } from "react";
import { PagedList } from "@/components/PagedList";
import type { ScreenProps } from "@/navigation/types";
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
import { Palette, secondaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import type { FaceReview } from "@/services/types";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ICON } from "@/constants/icons";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";
import { openAttachment, saveAttachment } from "@/utils/attachment";
import { useFaceReview } from "@/hooks/useFaceReview";

// HR: tinjau pendaftaran wajah yang menunggu (selfie, KTP, foto profil, skor kemiripan) lalu setujui atau tolak.
export function FaceReviewScreen({ navigation }: ScreenProps) {
  const {
    enrollmentList,
    items,
    rejectTarget,
    setRejectTarget,
    reason,
    setReason,
    busyId,
    errorMessage,
    setErrorMessage,
    approve,
    submitReject,
  } = useFaceReview();
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackAnimated(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>{t("fr.judul")}</Text>
          <Text style={styles.headerSub}>{t("fr.sub")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
        {enrollmentList.error && !enrollmentList.data ? (
          <ErrorState
            message={enrollmentList.error}
            onRetry={enrollmentList.retry}
          />
        ) : enrollmentList.isLoading ? (
          <Skeleton width="100%" height={220} radius={22} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ICON.shield}
            title={t("fr.kosongJudul")}
            text={t("fr.kosongIsi")}
          />
        ) : (
          <PagedList
            items={items}
            renderItem={(f) => (
              <Card
                key={f.name}
                f={f}
                isBusy={busyId === f.name}
                onApprove={() => approve(f)}
                onReject={() => {
                  setReason("");
                  setErrorMessage(null);
                  setRejectTarget(f);
                }}
              />
            )}
          />
        )}
      </ScrollView>

      <Modal
        visible={!!rejectTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{t("fr.tolakJudul")}</Text>
            <Text style={styles.meta}>{rejectTarget?.employeeName}</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder={t("fr.alasan")}
              placeholderTextColor={c.mutedLabel}
              multiline
            />
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                style={[
                  styles.button,
                  {
                    ...secondaryButtonStyle(c),
                  },
                ]}
                onPress={() => setRejectTarget(null)}
              >
                <Text style={[styles.buttonText, { color: c.btnSoftInk }]}>
                  {t("umum.batal")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.button, { backgroundColor: c.bad.ink }]}
                onPress={submitReject}
              >
                <Text style={[styles.buttonText, { color: "#fff" }]}>
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

function Card({
  f,
  isBusy,
  onApprove,
  onReject,
}: {
  f: FaceReview;
  isBusy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const score = (label: string, v: number | null, min?: number) => {
    if (v === null || v === undefined) return null;
    const isLow = min !== undefined && v < min;
    return (
      <View
        key={label}
        style={[styles.skor, { borderColor: isLow ? c.bad.ink : c.ok.ink }]}
      >
        <Text
          style={[styles.scoreText, { color: isLow ? c.bad.ink : c.ok.ink }]}
        >
          {label}: {Math.round(v * 10) / 10}%
          {min !== undefined ? `  (${t("fr.min", { n: min })})` : ""}
        </Text>
      </View>
    );
  };
  const isSpoofLow = f.spoofMean !== null && f.spoofMean < 0.75;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{f.employeeName}</Text>
      <Text style={styles.meta}>
        {f.employee} · {f.created.slice(0, 16).replace("T", " ")}
      </Text>
      <View style={styles.photoRow}>
        <Photo url={f.selfieUrl} label={t("fr.selfie")} />
        <Photo url={f.ktpUrl} label={t("fr.ktp")} />
        <Photo url={f.profileUrl} label={t("fr.profil")} />
      </View>
      <View style={{ gap: 6, marginTop: 12 }}>
        {score(t("fr.skorKtp"), f.scoreKtp, f.minKtp)}
        {score(t("fr.skorProfil"), f.scoreProfile, f.minProfile)}
        {score(t("fr.skorProfilKtp"), f.scoreProfileKtp, f.minKtp)}
        {f.spoofMean !== null ? (
          <View
            style={[
              styles.skor,
              { borderColor: isSpoofLow ? c.warn.ink : c.ok.ink },
            ]}
          >
            <Text
              style={[
                styles.scoreText,
                { color: isSpoofLow ? c.warn.ink : c.ok.ink },
              ]}
            >
              {t("fr.spoof", { n: f.spoofMean.toFixed(2) })}
              {isSpoofLow ? `  (${t("fr.spoofRendah")})` : ""}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: c.bad.bg,
              borderWidth: 1.5,
              borderColor: c.bad.ink,
            },
          ]}
          onPress={onReject}
          disabled={isBusy}
        >
          <Text style={[styles.buttonText, { color: c.bad.ink }]}>
            {t("fr.tolak")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, { backgroundColor: c.accent }]}
          onPress={onApprove}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.buttonText, { color: "#fff" }]}>
              {t("fr.setujui")}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// Foto privat: diunduh dengan sesi aplikasi. Gambar tampil langsung; PDF (mis. KTP hasil pindai) berupa tombol buka.
function Photo({ url, label }: { url: string | null; label: string }) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isPdf = !!url && /\.pdf($|\?)/i.test(url);
  const [uri, setUri] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  useEffect(() => {
    if (!url || isPdf) return;
    let isCancelled = false;
    saveAttachment(url, `wajah-${label}`)
      .then((u) => !isCancelled && setUri(u))
      .catch(() => !isCancelled && setHasFailed(true));
    return () => {
      isCancelled = true;
    };
  }, [url, isPdf, label]);
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Pressable
        style={styles.photoBox}
        disabled={!url}
        onPress={() => url && openAttachment(url, label).catch(() => {})}
      >
        {!url ? (
          <Text style={styles.photoEmpty}>{t("fr.tanpaFoto")}</Text>
        ) : isPdf ? (
          <View style={{ alignItems: "center", gap: 4 }}>
            <Ionicons name="document-text-outline" size={26} color={c.accent} />
            <Text style={styles.photoEmpty}>{t("fr.buka")}</Text>
          </View>
        ) : uri ? (
          <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
        ) : hasFailed ? (
          <Text style={styles.photoEmpty}>{t("fr.tanpaFoto")}</Text>
        ) : (
          <ActivityIndicator color={c.accent} />
        )}
      </Pressable>
      <Text style={styles.photoLabel}>{label}</Text>
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
    list: { paddingHorizontal: 18, paddingBottom: 180, gap: 12 },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", color: c.ink },
    meta: { fontSize: 11, color: c.muted, marginTop: 3 },
    photoRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    photoBox: {
      width: "100%",
      aspectRatio: 3 / 4,
      borderRadius: 14,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    photo: { width: "100%", height: "100%" },
    photoEmpty: { fontSize: 10.5, fontWeight: "600", color: c.muted },
    photoLabel: { fontSize: 11, fontWeight: "600", color: c.ink, marginTop: 6 },
    skor: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    scoreText: { fontSize: 12, fontWeight: "700" },
    button: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      paddingVertical: 13,
    },
    buttonText: { fontSize: 13, fontWeight: "700" },
    errorText: { fontSize: 12, color: c.bad.ink, fontWeight: "600" },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
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
