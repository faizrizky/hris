import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import {
  TOTAL_SYARAT,
  labelKekuatan,
  skorPassword,
  syaratPassword,
  toneKekuatan,
} from "@/utils/password";

export function ProfilePasswordScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [tampil, setTampil] = useState(false);
  const [sending, setSending] = useState(false);
  const [selesai, setSelesai] = useState(false);

  const syarat = syaratPassword(baru);
  const skor = skorPassword(baru);
  const tone = c[toneKekuatan(baru)];
  const cocok = konfirmasi.length > 0 && konfirmasi === baru;

  const blockMsg = !lama
    ? "Password saat ini belum diisi"
    : skor < TOTAL_SYARAT
      ? "Password baru belum memenuhi semua syarat"
      : baru === lama
        ? "Password baru tidak boleh sama dengan yang lama"
        : !cocok
          ? "Konfirmasi belum cocok"
          : "";
  const bisaSimpan = !blockMsg && !sending;

  const simpan = async () => {
    if (!employee || !bisaSimpan) return;
    setSending(true);
    try {
      await hrisApi.changePassword(employee.id, lama, baru);
      setSelesai(true);
    } finally {
      setSending(false);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>Ubah Password</Text>
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
            <Text style={styles.doneTitle}>Password berhasil diubah</Text>
            <Text style={styles.doneSub}>
              Gunakan password baru saat login berikutnya
            </Text>
          </LinearGradient>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryText}>Kembali ke Keamanan</Text>
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
              <Text style={styles.cardTitle}>Password</Text>
              <Pressable onPress={() => setTampil((v) => !v)} hitSlop={8}>
                <Text style={styles.link}>
                  {tampil ? "Sembunyikan" : "Tampilkan"}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Password saat ini</Text>
            <TextInput
              style={styles.input}
              value={lama}
              onChangeText={setLama}
              placeholder="Masukkan password lama"
              placeholderTextColor={c.mutedLabel}
              secureTextEntry={!tampil}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password baru</Text>
            <TextInput
              style={styles.input}
              value={baru}
              onChangeText={setBaru}
              placeholder="Minimal 8 karakter"
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

            <Text style={styles.label}>Konfirmasi password baru</Text>
            <TextInput
              style={styles.input}
              value={konfirmasi}
              onChangeText={setKonfirmasi}
              placeholder="Ulangi password baru"
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
                {cocok ? "Password cocok" : "Password tidak cocok"}
              </Text>
            )}
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>Syarat password</Text>
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
            <Text style={styles.note}>
              Setelah password diganti, perangkat lain diminta login ulang.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.barLabel, blockMsg ? { color: c.bad.ink } : null]}
          >
            {blockMsg || "Siap disimpan"}
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
              {sending ? "Menyimpan..." : "Simpan password"}
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
      backgroundColor: "rgba(255,255,255,0.22)",
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
      color: "rgba(255,255,255,0.82)",
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
