import { useMemo, useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { ApiError, describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import {
  TOTAL_SYARAT,
  labelKekuatan,
  skorPassword,
  syaratPassword,
  toneKekuatan,
} from "@/utils/password";
import { useT } from "@/i18n";
import { useConfirm } from "@/components/ConfirmDialog";

export function ProfilePasswordScreen({ navigation }: any) {
  const t = useT();
  const confirm = useConfirm();
  const { employee, setEmployee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [tampil, setTampil] = useState(false);
  const [sending, setSending] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const syarat = syaratPassword(baru);
  const skor = skorPassword(baru);
  const tone = c[toneKekuatan(baru)];
  const cocok = konfirmasi.length > 0 && konfirmasi === baru;

  const blockMsg = !lama
    ? t("pw.blokLama")
    : skor < TOTAL_SYARAT
      ? t("pw.blokSyarat")
      : baru === lama
        ? t("pw.blokSama")
        : !cocok
          ? t("pw.blokKonfirmasi")
          : "";
  const bisaSimpan = !blockMsg && !sending;

  const simpan = async () => {
    if (!employee || !bisaSimpan) return;
    setSending(true);
    setGalat(null);
    try {
      await hrisApi.changePassword(employee.id, lama, baru);
      setSelesai(true);
    } catch (e) {
      // Frappe menghapus sesi bila password lama salah (cookie sid dikosongkan),
      // jadi percobaan berikutnya selalu ditolak. Pengguna harus masuk lagi.
      if (e instanceof ApiError && e.excType === "WrongPassword") {
        await confirm({
          title: t("pw.salahJudul"),
          message: t("pw.salahPesan"),
          tone: "bad",
          confirmText: t("pw.masukLagi2"),
          cancelText: null,
        });
        setEmployee(null);
        return;
      }
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
      <Text style={styles.headerTitle}>{t("pw.judul")}</Text>
    </View>
  );

  if (selesai) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          <LinearGradient
            colors={[c.accent, c.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doneCard}
          >
            <View style={styles.doneCheck}>
              <Ionicons name="checkmark" size={30} color="#fff" />
            </View>
            <Text style={styles.doneTitle}>{t("pw.berhasil")}</Text>
            <Text style={styles.doneSub}>{t("pw.sesiBerakhir")}</Text>
          </LinearGradient>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => setEmployee(null)}
          >
            <Text style={styles.primaryText}>{t("pw.masukLagi")}</Text>
          </Pressable>
        </ScrollView>
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
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{t("pw.password")}</Text>
              <Pressable onPress={() => setTampil((v) => !v)} hitSlop={8}>
                <Text style={styles.link}>
                  {tampil ? t("pw.sembunyikan") : t("pw.tampilkan")}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>{t("pw.saatIni")}</Text>
            <TextInput
              style={styles.input}
              value={lama}
              onChangeText={setLama}
              placeholder={t("pw.masukkanLama")}
              placeholderTextColor={c.mutedLabel}
              secureTextEntry={!tampil}
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t("pw.baru")}</Text>
            <TextInput
              style={styles.input}
              value={baru}
              onChangeText={setBaru}
              placeholder={t("pw.min8Ph")}
              placeholderTextColor={c.mutedLabel}
              secureTextEntry={!tampil}
              autoCapitalize="none"
            />

            <View style={styles.strengthRow}>
              {[1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthSeg,
                    {
                      backgroundColor: baru && skor >= i ? tone.ink : c.track,
                    },
                  ]}
                />
              ))}
            </View>
            <Text
              style={[
                styles.strengthLabel,
                { color: baru ? tone.ink : c.mutedLabel },
              ]}
            >
              {labelKekuatan(baru)}
            </Text>

            <Text style={styles.label}>{t("pw.konfirmasi")}</Text>
            <TextInput
              style={styles.input}
              value={konfirmasi}
              onChangeText={setKonfirmasi}
              placeholder={t("pw.ulangi")}
              placeholderTextColor={c.mutedLabel}
              secureTextEntry={!tampil}
              autoCapitalize="none"
            />
            {konfirmasi.length > 0 && (
              <Text
                style={[
                  styles.matchLabel,
                  { color: cocok ? c.ok.ink : c.bad.ink },
                ]}
              >
                {cocok ? t("pw.cocok") : t("pw.tidakCocok")}
              </Text>
            )}
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("pw.syarat")}</Text>
            <View style={{ gap: 11, marginTop: 13 }}>
              {syarat.map((s) => (
                <View key={s.label} style={styles.ruleRow}>
                  <View
                    style={[
                      styles.ruleDot,
                      { backgroundColor: s.ok ? c.ok.ink : c.track },
                    ]}
                  >
                    {s.ok && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                  <Text
                    style={[styles.ruleText, { color: s.ok ? c.ink : c.muted }]}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.note}>{t("pw.catatan")}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              styles.barLabel,
              blockMsg || galat ? { color: c.bad.ink } : null,
            ]}
          >
            {blockMsg || galat || t("pw.siap")}
          </Text>
        </View>
        <Pressable onPress={simpan} disabled={!bisaSimpan}>
          <LinearGradient
            colors={bisaSimpan ? [c.accent, c.accent2] : [c.track, c.track]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            <Text
              style={[styles.saveText, bisaSimpan ? { color: "#fff" } : null]}
            >
              {sending ? t("pw.menyimpan") : t("pw.simpan")}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
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

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },

    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    cardHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    link: { fontSize: 11.5, fontWeight: "600", color: c.accent },

    label: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.mutedLabel,
      marginTop: 14,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 13.5,
      fontWeight: "500",
      color: c.ink,
    },

    strengthRow: { flexDirection: "row", gap: 5, marginTop: 12 },
    strengthSeg: { flex: 1, height: 5, borderRadius: 3 },
    strengthLabel: { fontSize: 11, fontWeight: "700", marginTop: 7 },
    matchLabel: { fontSize: 10.5, fontWeight: "600", marginTop: 6 },

    ruleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    ruleDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    ruleText: { fontSize: 12, fontWeight: "500" },
    note: {
      fontSize: 10.5,
      lineHeight: 16,
      fontWeight: "500",
      color: c.muted,
      marginTop: 13,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },

    doneCard: {
      alignItems: "center",
      borderRadius: 22,
      paddingHorizontal: 20,
      paddingVertical: 28,
    },
    doneCheck: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: c.onDark.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    doneTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: "#fff",
      marginTop: 14,
      textAlign: "center",
    },
    doneSub: {
      fontSize: 12.5,
      lineHeight: 19,
      fontWeight: "600",
      color: c.onDark.ink,
      marginTop: 6,
      textAlign: "center",
    },
    primaryBtn: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 22,
      backgroundColor: c.accent,
      alignItems: "center",
    },
    primaryText: { fontSize: 13, fontWeight: "700", color: "#fff" },

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
    barLabel: { fontSize: 11, fontWeight: "600", color: c.muted },
    saveBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16 },
    saveText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
