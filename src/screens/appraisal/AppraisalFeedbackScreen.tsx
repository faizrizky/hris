import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { FeedbackForm } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { desimal } from "@/utils/currency";
import { useT } from "@/i18n";

const LANGKAH = 0.5;

// Atasan/HR menilai satu anggota tim: nilai 0–5 per kriteria dan catatan.
// Bisa disimpan sebagai draft; setelah dikirim tidak bisa diubah lagi.
export function AppraisalFeedbackScreen({ navigation, route }: any) {
  const { employeeId, employeeName } = route.params;
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();

  const [form, setForm] = useState<FeedbackForm | null>(null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [coba, setCoba] = useState(0);
  const [nilai, setNilai] = useState<Record<string, number>>({});
  const [catatan, setCatatan] = useState("");
  const [sending, setSending] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    hrisApi
      .getFeedbackForm(employeeId)
      .then((f) => {
        if (batal) return;
        setForm(f);
        setNilai(
          f.mine?.ratings ??
            Object.fromEntries(f.criteria.map((k) => [k.name, 3])),
        );
        setCatatan(f.mine?.feedback ?? "");
      })
      .catch((e) => !batal && setGalatMuat(describeError(e)));
    return () => {
      batal = true;
    };
  }, [employeeId, coba]);

  const terkirim = form?.mine?.status === "submitted";
  const totalBobot = form?.criteria.reduce((a, k) => a + k.weight, 0) ?? 0;
  const skor = form
    ? form.criteria.reduce(
        (a, k) =>
          a + (nilai[k.name] ?? 0) * (totalBobot ? k.weight / totalBobot : 0),
        0,
      )
    : 0;

  const ubah = (k: string, d: number) =>
    setNilai((p) => ({
      ...p,
      [k]: Math.min(5, Math.max(0, (p[k] ?? 0) + d)),
    }));

  const simpan = async (submit: boolean) => {
    if (!catatan.trim()) {
      setGalat(t("fb.catatanWajib"));
      return;
    }
    if (submit) {
      const ya = await confirm({
        title: t("fb.kirimJudul"),
        message: t("fb.kirimPesan", { nama: employeeName }),
        tone: "warn",
        confirmText: t("fb.kirim"),
        cancelText: t("umum.batal"),
      });
      if (!ya) return;
    }
    setSending(true);
    setGalat(null);
    try {
      await hrisApi.submitFeedback({
        employeeId,
        ratings: nilai,
        feedback: catatan.trim(),
        submit,
      });
      navigation.goBack();
    } catch (e) {
      setGalat(describeError(e));
    } finally {
      setSending(false);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {employeeName}
        </Text>
        <Text style={styles.headerSub}>{form?.cycle ?? t("fb.judul")}</Text>
      </View>
    </View>
  );

  if (!form) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          {galatMuat ? (
            <ErrorState
              pesan={galatMuat}
              onUlangi={() => {
                setGalatMuat(null);
                setCoba((n) => n + 1);
              }}
            />
          ) : (
            <>
              <Skeleton width="100%" height={110} radius={22} />
              <Skeleton
                width="100%"
                height={220}
                radius={22}
                style={{ marginTop: 12 }}
              />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={[c.accent, c.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroLabel}>{t("fb.skorKamu")}</Text>
            <Text style={styles.heroValue}>
              {desimal(skor)} <Text style={styles.heroMax}>/ 5</Text>
            </Text>
            <Text style={styles.heroLabel}>
              {terkirim
                ? t("fb.sudahTerkirim")
                : form.mine
                  ? t("fb.draftTersimpan")
                  : t("fb.belumDinilai")}
            </Text>
          </LinearGradient>

          {form.goals.length > 0 && (
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardTitle}>{t("fb.goal")}</Text>
              <View style={{ gap: 12, marginTop: 12 }}>
                {form.goals.map((g) => (
                  <View key={g.name}>
                    <View style={styles.goalHead}>
                      <Text style={styles.goalName}>{g.name}</Text>
                      <Text style={styles.goalPct}>{g.progress}%</Text>
                    </View>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.fill,
                          { width: `${Math.min(100, g.progress)}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("fb.kriteria")}</Text>
            <View style={{ gap: 14, marginTop: 12 }}>
              {form.criteria.map((k) => {
                const v = nilai[k.name] ?? 0;
                return (
                  <View key={k.name}>
                    <View style={styles.critHead}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.critName}>{k.name}</Text>
                        <Text style={styles.critWeight}>
                          {t("fb.bobot", { n: k.weight })}
                        </Text>
                      </View>
                      {!terkirim && (
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => ubah(k.name, -LANGKAH)}
                        >
                          <Ionicons name="remove" size={15} color={c.ink} />
                        </Pressable>
                      )}
                      <Text style={styles.critValue}>{desimal(v)}</Text>
                      {!terkirim && (
                        <Pressable
                          style={[styles.stepBtn, styles.stepBtnOn]}
                          onPress={() => ubah(k.name, LANGKAH)}
                        >
                          <Ionicons name="add" size={15} color="#fff" />
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.track}>
                      <View
                        style={[styles.fill, { width: `${(v / 5) * 100}%` }]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("fb.catatan")}</Text>
            <TextInput
              style={styles.textarea}
              value={catatan}
              onChangeText={setCatatan}
              editable={!terkirim}
              placeholder={t("fb.catatanContoh")}
              placeholderTextColor={c.mutedLabel}
              multiline
            />
          </View>
          {galat ? <Text style={styles.galat}>{galat}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {!terkirim && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
          <Pressable
            style={styles.draftBtn}
            disabled={sending}
            onPress={() => simpan(false)}
          >
            <Text style={styles.draftText}>{t("fb.simpanDraft")}</Text>
          </Pressable>
          <Pressable
            style={{ flex: 2 }}
            disabled={sending}
            onPress={() => simpan(true)}
          >
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              <Text style={styles.sendText}>
                {sending ? t("umum.memproses") : t("fb.kirim")}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
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
    content: { paddingHorizontal: 18, paddingBottom: 40 },
    hero: { borderRadius: 22, padding: 18 },
    heroLabel: {
      fontSize: 11.5,
      fontWeight: "600",
      color: "rgba(255,255,255,0.8)",
    },
    heroValue: {
      fontSize: 30,
      fontWeight: "800",
      color: "#fff",
      marginVertical: 6,
    },
    heroMax: {
      fontSize: 15,
      fontWeight: "700",
      color: "rgba(255,255,255,0.7)",
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    goalHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    goalName: { flex: 1, fontSize: 12, fontWeight: "600", color: c.ink },
    goalPct: { fontSize: 12, fontWeight: "700", color: c.accent },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.track,
      marginTop: 8,
      overflow: "hidden",
    },
    fill: { height: 6, borderRadius: 3, backgroundColor: c.accent },
    critHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    critName: { fontSize: 12.5, fontWeight: "700", color: c.ink },
    critWeight: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },
    critValue: {
      minWidth: 34,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "800",
      color: c.ink,
    },
    stepBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    stepBtnOn: { backgroundColor: c.accent },
    textarea: {
      marginTop: 10,
      minHeight: 100,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      padding: 12,
      fontSize: 13,
      color: c.ink,
      textAlignVertical: "top",
    },
    galat: {
      marginTop: 12,
      fontSize: 12,
      fontWeight: "600",
      color: c.bad.ink,
      textAlign: "center",
    },
    actionBar: {
      flexDirection: "row",
      gap: 9,
      paddingHorizontal: 18,
      paddingTop: 12,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    draftBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.chip,
      alignItems: "center",
    },
    draftText: { fontSize: 13, fontWeight: "700", color: c.ink },
    sendBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    sendText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
