import React, { useState, useMemo, useEffect } from "react";
import {
  KeyboardAvoidingView,
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
import {
  alamatServer,
  aturAlamatServer,
  describeError,
} from "../../services/api/http";
import { useT } from "@/i18n";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LogoHris } from "@/components/LogoHris";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  adaLoginBiometrik,
  bacaKredensial,
  hapusKredensial,
  kesiapanBiometrik,
  namaBiometrik,
} from "@/services/biometrik";

const KUNCI_USERNAME = "hris.username";

export function LoginScreen() {
  const { setEmployee } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [namaBio, setNamaBio] = useState("sidik jari / wajah");
  const [showPassword, setShowPassword] = useState(false);
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState(alamatServer());
  const [bukaServer, setBukaServer] = useState(false);

  // "Ingat saya": username terakhir diisi otomatis (password tidak pernah disimpan). Tersimpan di
  // penyimpanan aplikasi sehingga tetap ada setelah pembaruan.
  useEffect(() => {
    AsyncStorage.getItem(KUNCI_USERNAME)
      .then((v) => {
        if (v) setEmail(v);
      })
      .catch(() => {});
  }, []);

  // Biometrik hanya ditawarkan bila perangkat ini sudah punya sidik jari / wajah terdaftar.
  useEffect(() => {
    namaBiometrik().then(setNamaBio);
  }, []);

  // Alamat tersimpan dibaca asinkron; isi kolom setelah siap.
  useEffect(() => {
    const id = setTimeout(() => setServer(alamatServer()), 300);
    return () => clearTimeout(id);
  }, []);

  const masukDenganBiometrik = async () => {
    setError(null);
    const k = await kesiapanBiometrik();
    if (k === "tidakAda") return setError(t("bio.tidakAda"));
    if (k === "belumDaftar") return setError(t("bio.belumDaftar"));
    if (!(await adaLoginBiometrik())) return setError(t("bio.belumAktif"));
    const kred = await bacaKredensial(t("bio.pesanLogin"), t("kunci.batal"));
    if (!kred) return; // dibatalkan atau gagal verifikasi
    setLoading(true);
    try {
      setServer(await aturAlamatServer(server));
      const employee = await hrisApi.login(kred.u, kred.p);
      setEmployee(employee);
    } catch {
      await hapusKredensial(); // password berubah atau sesi tidak valid: aktifkan lagi dengan password
      setError(t("bio.gagalMasuk"));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      setServer(await aturAlamatServer(server));
      const employee = await hrisApi.login(email.trim(), password);

      if (rememberMe) {
        await AsyncStorage.setItem(KUNCI_USERNAME, email.trim()).catch(
          () => {},
        );
      } else {
        await AsyncStorage.removeItem(KUNCI_USERNAME).catch(() => {});
      }
      setEmployee(employee);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <RadialGlow size={340} color={c.glowTop} top={-120} right={-90} />
      <RadialGlow size={320} color={c.glowBottom} bottom={-140} left={-110} />

      {/* Ikut alur layout (bukan absolute): saat keyboard muncul hero mengecil
          dan terpotong di bawah pemilih bahasa, bukan menimpanya. */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          alignItems: "flex-start",
          zIndex: 2,
        }}
      >
        <LanguagePicker />
      </View>

      {/* Hero — logo, headline, subtext, nempel ke bawah area gelap */}
      <View style={styles.hero}>
        <View style={styles.iconBadge}>
          <LogoHris size={52} />
        </View>

        <Text style={styles.headline}>
          {t("login.judul1")}
          {"\n"}
          <Text style={styles.headlineAccent}>{t("login.judul2")}</Text>
        </Text>
        <Text style={styles.subtext}>{t("login.sub")}</Text>
      </View>

      {/* Sheet putih melengkung di bawah — form login beneran */}
      <KeyboardAvoidingView behavior="padding">
        <View style={[styles.sheet, { paddingBottom: 10 + insets.bottom }]}>
          <Text style={styles.sheetTitle}>{t("login.masukAkun")}</Text>
          <Text style={styles.sheetSubtitle}>{t("login.gunakanEmail")}</Text>

          <View style={styles.fieldsWrapper}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>{t("login.email")}</Text>
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("login.usernameIsi")}
                placeholderTextColor={c.mutedLabel}
              />
            </View>

            <View style={styles.fieldBox}>
              <View style={styles.passwordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t("login.password")}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder={t("login.passwordIsi")}
                    placeholderTextColor={c.mutedLabel}
                  />
                </View>
                <Pressable onPress={() => setShowPassword((v) => !v)}>
                  <Text style={styles.showToggle}>
                    {showPassword ? t("login.sembunyikan") : t("login.lihat")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Pressable onPress={() => setBukaServer((v) => !v)}>
            <Text style={styles.serverToggle}>
              {t("login.server")}: {server || "—"}
            </Text>
          </Pressable>
          {bukaServer && (
            <View style={[styles.fieldBox, { marginTop: 8 }]}>
              <Text style={styles.fieldLabel}>{t("login.alamatServer")}</Text>
              <TextInput
                style={styles.fieldInput}
                value={server}
                onChangeText={setServer}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.1.43:8082"
                placeholderTextColor={c.mutedLabel}
              />
            </View>
          )}

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
              <Text style={styles.rememberLabel}>{t("login.ingat")}</Text>
            </Pressable>
            <Text style={styles.forgotLabel}>{t("login.lupa")}</Text>
          </View>

          <Text style={styles.hint}>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </Text>

          <Pressable onPress={handleLogin} disabled={loading}>
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitButton}
            >
              <Text style={styles.submitLabel}>
                {loading ? t("login.memproses") : t("login.masuk")}
              </Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>{t("login.atau")}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.faceIdButton}
            onPress={masukDenganBiometrik}
            disabled={loading}
          >
            <View style={styles.faceIdIcon}>
              <View style={styles.faceIdIconInner} />
            </View>
            <Text style={styles.faceIdLabel}>
              {t("login.faceId", { nama: namaBio })}
            </Text>
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
      overflow: "hidden",
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
    serverToggle: {
      fontSize: 11,
      fontWeight: "600",
      color: c.accent2,
      marginTop: 12,
    },
    errorText: { color: c.bad.ink, fontSize: 13, marginBottom: 10 },
  });
