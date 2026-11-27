import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { RadialGlow } from "@/components/RadialGlow";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LogoHris } from "@/components/LogoHris";
import { useT } from "@/i18n";
import { describeError } from "@/services/api/http";
import { useTenant } from "@/services/tenant";

// Langkah pertama sebelum login: kode company menentukan server/site yang dihubungi.
// Dengan `isExpired`, layar yang sama memberi tahu langganan company sudah berakhir.
export function CompanyCodeScreen({
  isExpired = false,
}: {
  isExpired?: boolean;
}) {
  const { tenant, pilihCompany, gantiCompany, alasanKeluar } = useTenant();
  const [kode, setKode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const handleSubmit = async () => {
    if (!kode.trim()) return setError(t("kode.kosong"));
    setIsLoading(true);
    setError(null);
    try {
      await pilihCompany(kode);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bottomFiller} />
      <RadialGlow size={340} color={c.glowTop} top={-120} right={-90} />
      <RadialGlow size={320} color={c.glowBottom} bottom={-140} left={-110} />
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <LanguagePicker />
      </View>

      <View style={styles.hero}>
        <LogoHris size={52} />
        <Text style={styles.headline}>
          {isExpired ? t("kode.berakhirJudul") : t("kode.judul")}
        </Text>
        <Text style={styles.subtext}>
          {isExpired
            ? t("kode.berakhirSub", { nama: tenant?.nama ?? "" })
            : t("kode.sub")}
        </Text>
      </View>

      <KeyboardAvoidingView behavior="padding">
        <View style={[styles.sheet, { paddingBottom: 10 + insets.bottom }]}>
          {isExpired ? (
            <Pressable onPress={gantiCompany}>
              <Text style={styles.link}>{t("kode.ganti")}</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.fieldLabel}>{t("kode.label")}</Text>
              <View style={[styles.fieldBox, error ? styles.fieldError : null]}>
                <TextInput
                  // Wider letter spacing only for a typed code: on the placeholder it pushed the text past the box.
                  style={[styles.fieldInput, kode ? styles.fieldCode : null]}
                  accessibilityLabel={t("kode.label")}
                  value={kode}
                  onChangeText={setKode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  placeholder={t("kode.isi")}
                  placeholderTextColor={c.mutedLabel}
                />
              </View>
              {(error ?? alasanKeluar) && (
                <Text style={styles.errorText}>{error ?? alasanKeluar}</Text>
              )}
              <Pressable onPress={handleSubmit} disabled={isLoading}>
                <LinearGradient
                  colors={[c.accent, c.accent2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitLabel}>
                    {isLoading ? t("login.memproses") : t("kode.lanjut")}
                  </Text>
                </LinearGradient>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.headerBg },
    // Warna kartu di balik lembar bawah. Harus lebih pendek dari lembarnya: dulu 38% layar, lebih tinggi daripada
    // lembar yang pendek ini, sehingga judul putih jatuh di atas latar putih dan tampak terpotong.
    bottomFiller: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 60,
      backgroundColor: c.card,
    },
    top: { paddingHorizontal: 20, alignItems: "flex-start", zIndex: 2 },
    hero: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: 28,
      paddingBottom: 26,
    },
    headline: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: "800",
      color: "#fff",
      marginTop: 22,
    },
    subtext: {
      fontSize: 13.5,
      lineHeight: 22,
      color: c.onDark.muted,
      marginTop: 12,
      maxWidth: 300,
    },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 24,
      paddingTop: 26,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: c.ink,
      marginBottom: 8,
    },
    fieldBox: {
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      minHeight: 52,
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    fieldError: { borderColor: c.bad.ink },
    // No fixed line height and no zero padding box: Android clipped the glyphs.
    fieldInput: {
      fontSize: 16,
      color: c.ink,
      paddingVertical: 12,
      paddingHorizontal: 0,
    },
    fieldCode: { fontWeight: "600", letterSpacing: 1 },
    errorText: { color: c.bad.ink, fontSize: 13, marginTop: 10 },
    submitButton: {
      ...primaryButtonStyle(c),
      marginTop: 18,
      marginBottom: 16,
      paddingVertical: 15,
      borderRadius: 16,
      alignItems: "center",
    },
    submitLabel: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
    link: {
      fontSize: 14,
      fontWeight: "700",
      color: c.accent2,
      textAlign: "center",
      paddingVertical: 16,
    },
  });
