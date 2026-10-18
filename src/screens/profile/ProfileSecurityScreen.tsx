import { useMemo } from "react";
import type { ScreenProps } from "@/navigation/types";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Palette, secondaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ErrorState } from "@/components/ErrorState";
import { FaceState } from "@/services/types";
import { RadialGlow } from "@/components/RadialGlow";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";
import { formatShortDateWithYear } from "@/utils/date";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";
import { useProfileSecurity } from "@/hooks/useProfileSecurity";

// Warna pil status wajah di atas kartu gelap.
const PILL: Record<FaceState, { bg: string; ink: string }> = {
  active: { bg: "rgba(74,222,128,0.14)", ink: "#4ADE80" },
  pending: { bg: "rgba(251,191,36,0.16)", ink: "#FBBF24" },
  needs_reenroll: { bg: "rgba(251,191,36,0.16)", ink: "#FBBF24" },
  rejected: { bg: "rgba(248,113,113,0.16)", ink: "#F87171" },
  none: { bg: "rgba(148,163,184,0.18)", ink: "#CBD5E1" },
};

export function ProfileSecurityScreen({ navigation }: ScreenProps) {
  const {
    info,
    errorMessage,
    face,
    cacheKey,
    isBiometricLogin,
    biometricMessage,
    biometricName,
    isBiometricDialog,
    setIsBiometricDialog,
    biometricAccount,
    setBiometricAccount,
    biometricPassword,
    setBiometricPassword,
    biometricError,
    isBiometricBusy,
    load,
    toggleBiometric,
    enableBiometricLogin,
    changeLock,
    TIMEOUT_OPTIONS,
    changeToggle,
    signOutDevice,
  } = useProfileSecurity();
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Dua pengalih yang saling mengikat: Biometrik (login tanpa password) dan Kunci otomatis. Kunci otomatis hanya bisa
  // dinyalakan saat Biometrik aktif, dan mematikan Biometrik otomatis mematikan Kunci otomatis.
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable
        style={styles.backBtn}
        onPress={() => goBackAnimated(navigation)}
      >
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>{t("sec.judul")}</Text>
    </View>
  );

  if (!info) {
    if (errorMessage) {
      return (
        <View style={styles.container}>
          {header}
          <View style={styles.content}>
            <ErrorState message={errorMessage} onRetry={load} />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          <Skeleton width="100%" height={160} radius={22} />
          <Skeleton
            width="100%"
            height={220}
            radius={22}
            style={{ marginTop: 12 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          style={styles.faceCard}
          onPress={() => navigation.navigate("FaceEnroll")}
        >
          <RadialGlow size={200} color={c.glowHeader} top={-60} right={-40} />

          <View style={styles.faceTop}>
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.faceIcon}
            >
              <LineIcon d={ICON.faceId} color="#fff" size={28} />
            </LinearGradient>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.faceTitle}>{t("profil.wajah")}</Text>
              <Text style={styles.faceSub}>
                {face ? t(`sec.wajahSub.${face.state}` as never) : "…"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.onDark.muted} />
          </View>

          {face ? (
            <View style={styles.facePills}>
              <View
                style={[styles.pill, { backgroundColor: PILL[face.state].bg }]}
              >
                <Text
                  style={[styles.pillText, { color: PILL[face.state].ink }]}
                >
                  {t(`sec.wajah.${face.state}` as never)}
                </Text>
              </View>
              {face.state === "needs_reenroll" && face.graceUntil ? (
                <View
                  style={[styles.pill, { backgroundColor: PILL.pending.bg }]}
                >
                  <Text style={[styles.pillText, { color: PILL.pending.ink }]}>
                    {t("sec.batas", {
                      tgl: formatShortDateWithYear(face.graceUntil),
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("sec.keamananAkun")}</Text>

          <Text style={styles.groupLabel}>{t("sec.grupBiometrik")}</Text>
          <View style={styles.baris}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>
                {t("bio.loginBio", { nama: biometricName })}
              </Text>
              <Text style={styles.rowSub}>
                {isBiometricLogin
                  ? t("bio.loginBioAktif")
                  : t("bio.loginBioMati")}
              </Text>
            </View>
            <Switch
              value={isBiometricLogin}
              onValueChange={toggleBiometric}
              trackColor={{ false: c.track, true: c.accent }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.baris, !isBiometricLogin && { opacity: 0.45 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{t("bio.kunciOtomatis")}</Text>
              <Text style={styles.rowSub}>
                {isBiometricLogin
                  ? t("bio.kunciSub", { nama: biometricName })
                  : t("bio.kunciButuhBiometrik")}
              </Text>
            </View>
            <Switch
              value={isBiometricLogin && cacheKey.settings.isActive}
              onValueChange={changeLock}
              disabled={!isBiometricLogin}
              trackColor={{ false: c.track, true: c.accent }}
              thumbColor="#fff"
            />
          </View>
          {isBiometricLogin && cacheKey.settings.isActive ? (
            <View style={{ paddingVertical: 8 }}>
              <Text style={styles.rowSub}>{t("bio.timeout")}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {TIMEOUT_OPTIONS.map(([ms, label]) => {
                  const isOn = cacheKey.settings.timeoutMs === ms;
                  return (
                    <Pressable
                      key={ms}
                      onPress={() =>
                        cacheKey.update({ ...cacheKey.settings, timeoutMs: ms })
                      }
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isOn ? c.accent : c.fieldBorder,
                        backgroundColor: isOn ? c.accent : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: "600",
                          color: isOn ? "#fff" : c.ink,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {biometricMessage ? (
            <Text style={[styles.rowSub, { color: c.bad.ink, marginTop: 8 }]}>
              {biometricMessage}
            </Text>
          ) : null}

          <Text style={[styles.groupLabel, { marginTop: 18 }]}>
            {t("sec.grupAkun")}
          </Text>
          <Pressable
            style={styles.baris}
            onPress={() => navigation.navigate("ProfilePassword")}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{t("sec.ubahPw")}</Text>
              <Text style={styles.rowSub}>
                {info.passwordChangedDaysAgo === 0
                  ? t("sec.baruSaja")
                  : t("sec.terakhir", { n: info.passwordChangedDaysAgo })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.mutedLabel} />
          </Pressable>
          {info.toggles.map((toggle, i) => (
            <View
              key={toggle.key}
              style={[
                styles.baris,
                i === info.toggles.length - 1 && styles.finalRow,
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>{toggle.title}</Text>
                <Text style={styles.rowSub}>{toggle.subtitle}</Text>
              </View>
              <Switch
                value={toggle.enabled}
                onValueChange={(v) => changeToggle(toggle.key, v)}
                trackColor={{ false: c.track, true: c.accent }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("sec.perangkat")}</Text>
          <View style={{ gap: 13, marginTop: 14 }}>
            {info.devices.map((d) => (
              <View key={d.id} style={styles.devRow}>
                <View style={styles.devIcon}>
                  <Ionicons
                    name={
                      d.kind === "mobile"
                        ? "phone-portrait-outline"
                        : "desktop-outline"
                    }
                    color={c.info.ink}
                    size={26}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.devName}>{d.name}</Text>
                  <Text style={styles.devMeta}>{d.meta}</Text>
                </View>
                {!d.current ? (
                  <Pressable
                    onPress={() => signOutDevice(d)}
                    hitSlop={8}
                    style={styles.devSignOut}
                  >
                    <Text style={styles.devSignOutText}>
                      {t("sec.keluarkan")}
                    </Text>
                  </Pressable>
                ) : null}
                <View
                  style={[
                    styles.devTag,
                    { backgroundColor: d.current ? c.ok.bg : c.info.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.devTagText,
                      { color: d.current ? c.ok.ink : c.info.ink },
                    ]}
                  >
                    {d.current
                      ? t("sec.iniPerangkat")
                      : d.kind === "mobile"
                        ? t("sec.aplikasi")
                        : t("sec.web")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={isBiometricDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBiometricDialog(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>
              {t("bio.pwJudul", { nama: biometricName })}
            </Text>
            <Text style={[styles.rowSub, { marginTop: 6 }]}>
              {t("bio.pwSub", { nama: biometricName })}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={biometricAccount}
              onChangeText={setBiometricAccount}
              placeholder={t("bio.akun")}
              placeholderTextColor={c.mutedLabel}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.modalInput}
              value={biometricPassword}
              onChangeText={setBiometricPassword}
              placeholder={t("bio.password")}
              placeholderTextColor={c.mutedLabel}
              secureTextEntry
              autoCapitalize="none"
            />
            {biometricError ? (
              <Text style={[styles.rowSub, { color: c.bad.ink, marginTop: 8 }]}>
                {biometricError}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                style={[
                  styles.modalButton,
                  {
                    ...secondaryButtonStyle(c),
                  },
                ]}
                onPress={() => setIsBiometricDialog(false)}
                disabled={isBiometricBusy}
              >
                <Text style={{ fontWeight: "700", color: c.btnSoftInk }}>
                  {t("kunci.batal")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: c.accent,
                    opacity: biometricAccount && biometricPassword ? 1 : 0.5,
                  },
                ]}
                onPress={enableBiometricLogin}
                disabled={
                  isBiometricBusy || !biometricAccount || !biometricPassword
                }
              >
                {isBiometricBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontWeight: "700", color: "#fff" }}>
                    {t("bio.aktifkan")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 170 },

    faceCard: {
      backgroundColor: c.statBg,
      borderRadius: 22,
      padding: 18,
      overflow: "hidden",
    },
    faceTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    faceIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    faceTitle: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
    faceSub: {
      fontSize: 11,
      lineHeight: 17,
      fontWeight: "500",
      color: c.onDark.muted,
      marginTop: 3,
    },
    facePills: { flexDirection: "row", gap: 8, marginTop: 14 },
    pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
    pillText: { fontSize: 10.5, fontWeight: "600" },

    listCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      marginTop: 12,
      overflow: "hidden",
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 15,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    lastRow: { borderBottomWidth: 0 },
    rowTitle: { fontSize: 13, fontWeight: "600", color: c.ink },
    rowSub: {
      fontSize: 10.5,
      lineHeight: 15,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    groupLabel: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: c.muted,
      marginTop: 14,
      marginBottom: 2,
    },
    baris: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    finalRow: { borderBottomWidth: 0 },
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
    modalInput: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: c.ink,
    },
    modalButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      paddingVertical: 13,
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      marginTop: 12,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },

    devRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    devIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    devName: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    devMeta: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },
    devTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    devTagText: { fontSize: 10, fontWeight: "700" },

    devSignOut: {
      borderWidth: 1,
      borderColor: c.bad.ink,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      marginRight: 6,
    },
    devSignOutText: { fontSize: 11, fontWeight: "700", color: c.bad.ink },
    dangerBtn: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 22,
      backgroundColor: c.bad.bg,
      alignItems: "center",
    },
    dangerText: { fontSize: 13, fontWeight: "700", color: c.bad.ink },

    okBanner: {
      marginTop: 12,
      paddingVertical: 13,
      borderRadius: 22,
      backgroundColor: c.ok.bg,
      alignItems: "center",
    },
    okText: { fontSize: 12, fontWeight: "700", color: c.ok.ink },
  });
