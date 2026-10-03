import React, { useState, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { RadialGlow } from "@/components/RadialGlow";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function LoginScreen() {
  const { setEmployee } = useSession();
  const [email, setEmail] = useState("ess@falah.co");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const employee = await hrisApi.login(email, password);
      setEmployee(employee);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <RadialGlow size={340} color={c.glowTop} top={-120} right={-90} />
      <RadialGlow size={320} color={c.glowBottom} bottom={-140} left={-110} />

      {/* Hero — logo, headline, subtext, nempel ke bawah area gelap */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[c.accent, c.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBadge}
        >
          <View style={styles.iconBadgeMark} />
        </LinearGradient>

        <Text style={styles.headline}>
          Kelola HR Anda{"\n"}
          <Text style={styles.headlineAccent}>dari satu aplikasi</Text>
        </Text>
        <Text style={styles.subtext}>
          Presensi, cuti, payroll, dan approval — tersinkron langsung dengan
          ERPNext.
        </Text>
      </View>

      {/* Sheet putih melengkung di bawah — form login beneran */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.sheet, { paddingBottom: 10 + insets.bottom }]}>
          <Text style={styles.sheetTitle}>Masuk ke akun</Text>
          <Text style={styles.sheetSubtitle}>Gunakan email kantor Anda</Text>

          <View style={styles.fieldsWrapper}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="ess@falah.co"
                placeholderTextColor={c.mutedLabel}
              />
            </View>

            <View style={styles.fieldBox}>
              <View style={styles.passwordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="bebas — belum terhubung ke ERPNext"
                    placeholderTextColor={c.mutedLabel}
                  />
                </View>
                <Pressable onPress={() => setShowPassword((v) => !v)}>
                  <Text style={styles.showToggle}>
                    {showPassword ? "Sembunyikan" : "Lihat"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <Pressable
              style={styles.rememberRow}
              onPress={() => setRememberMe((v) => !v)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe && (
                  <Ionicons name="checkmark" size={11} color="#fff" />
                )}
              </View>
              <Text style={styles.rememberLabel}>Ingat saya</Text>
            </Pressable>
            <Text style={styles.forgotLabel}>Lupa password?</Text>
          </View>

          <Text style={styles.hint}>
            Tip: ganti prefix email (ess / mss / hr) buat coba tampilan tiap
            role.
          </Text>

          <Pressable onPress={handleLogin} disabled={loading}>
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitButton}
            >
              <Text style={styles.submitLabel}>
                {loading ? "Memproses..." : "Masuk"}
              </Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>atau</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.faceIdButton}
            onPress={handleLogin}
            disabled={loading}
          >
            <View style={styles.faceIdIcon}>
              <View style={styles.faceIdIconInner} />
            </View>
            <Text style={styles.faceIdLabel}>Masuk dengan Face ID</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.headerBg },
    hero: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: 28,
      paddingBottom: 26,
    },
    iconBadge: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
    },
    iconBadgeMark: {
      width: 18,
      height: 18,
      borderWidth: 3,
      borderColor: "#fff",
      borderRadius: 5,
    },
    headline: {
      fontSize: 33,
      lineHeight: 38,
      fontWeight: "800",
      color: "#fff",
    },
    headlineAccent: { color: c.accentLight },
    subtext: {
      fontSize: 13.5,
      lineHeight: 22,
      color: c.onDark.muted,
      marginTop: 12,
      maxWidth: 290,
    },

    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 24,
      paddingTop: 26,
      paddingBottom: 44,
    },
    sheetTitle: { fontSize: 16, fontWeight: "700", color: c.ink },
    sheetSubtitle: { fontSize: 12, color: c.muted, marginTop: 5 },

    fieldsWrapper: { marginTop: 18, gap: 10 },
    fieldBox: {
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.mutedLabel,
    },
    fieldInput: {
      fontSize: 14,
      fontWeight: "500",
      color: c.ink,
      marginTop: 3,
      padding: 0,
    },

    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14,
    },
    rememberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    checkbox: {
      width: 17,
      height: 17,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: { backgroundColor: c.accent },
    rememberLabel: { fontSize: 12, color: c.muted, fontWeight: "500" },
    forgotLabel: { fontSize: 12, fontWeight: "600", color: c.accent2 },

    hint: { fontSize: 11, color: c.muted, marginTop: 10, lineHeight: 15 },

    submitButton: {
      marginTop: 18,
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: "center",
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 6,
    },
    submitLabel: { color: "#fff", fontSize: 14.5, fontWeight: "700" },

    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
      marginBottom: 14,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.hair },
    dividerLabel: { fontSize: 11, color: c.mutedLabel, fontWeight: "500" },

    faceIdButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 16,
      paddingVertical: 13,
    },
    faceIdIcon: {
      width: 18,
      height: 18,
      borderWidth: 2,
      borderColor: c.accent,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    faceIdIconInner: {
      position: "absolute",
      top: 3,
      left: 3,
      right: 3,
      bottom: 3,
      borderRadius: 2,
      backgroundColor: c.info.bg,
    },
    faceIdLabel: { fontSize: 13.5, fontWeight: "600", color: c.ink },
    passwordRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    showToggle: { fontSize: 11.5, fontWeight: "600", color: c.accent2 },
  });
