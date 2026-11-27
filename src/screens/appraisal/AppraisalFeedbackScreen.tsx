import { useMemo } from "react";
import { type ScreenProps } from "@/navigation/types";
import {
  KeyboardAvoidingView,
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
import {
  Palette,
  secondaryButtonStyle,
  primaryButtonStyle,
} from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { formatDecimal } from "@/utils/currency";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";
import { useAppraisalFeedback } from "@/hooks/useAppraisalFeedback";

const STEPS = 0.5;

// Atasan/HR menilai satu anggota tim: nilai 0–5 per kriteria dan catatan.
// Bisa disimpan sebagai draft; setelah dikirim tidak bisa diubah lagi.
export function AppraisalFeedbackScreen({ navigation, route }: ScreenProps) {
  const {
    employeeName,
    isSelf,
    triggerRef,
    form,
    loadError,
    setLoadError,
    setAttempt,
    ratingValue,
    note,
    setNote,
    isSending,
    errorMessage,
    isSubmitted,
    score,
    update,
    save,
  } = useAppraisalFeedback({ navigation, route });
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Dialog konfirmasi tumbuh dari tombol ini, seperti dialog Keluar.
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable
        style={styles.backBtn}
        onPress={() => goBackAnimated(navigation)}
      >
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {employeeName}
        </Text>
        <Text style={styles.headerSub}>
          {form?.cycle ?? t(isSelf ? "fb.diriJudul" : "fb.judul")}
        </Text>
      </View>
    </View>
  );

  if (!form) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          {loadError ? (
            <ErrorState
              message={loadError}
              onRetry={() => {
                setLoadError(null);
                setAttempt((n) => n + 1);
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
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
              {formatDecimal(score)} <Text style={styles.heroMax}>/ 5</Text>
            </Text>
            <Text style={styles.heroLabel}>
              {isSubmitted
                ? t("fb.sudahTerkirim")
                : form.mine
                  ? t(isSelf ? "fb.diriTersimpan" : "fb.draftTersimpan")
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
                const v = ratingValue[k.name] ?? 0;
                return (
                  <View key={k.name}>
                    <View style={styles.critHead}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.critName}>{k.name}</Text>
                        <Text style={styles.critWeight}>
                          {t("fb.bobot", { n: k.weight })}
                        </Text>
                      </View>
                      {!isSubmitted && (
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => update(k.name, -STEPS)}
                        >
                          <Ionicons name="remove" size={15} color={c.ink} />
                        </Pressable>
                      )}
                      <Text style={styles.critValue}>{formatDecimal(v)}</Text>
                      {!isSubmitted && (
                        <Pressable
                          style={[styles.stepBtn, styles.stepBtnOn]}
                          onPress={() => update(k.name, STEPS)}
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
              value={note}
              onChangeText={setNote}
              editable={!isSubmitted}
              placeholder={t("fb.catatanContoh")}
              placeholderTextColor={c.mutedLabel}
              multiline
            />
          </View>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {!isSubmitted && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
          {isSelf ? null : (
            <Pressable
              style={styles.draftBtn}
              disabled={isSending}
              onPress={() => save(false)}
            >
              <Text style={styles.draftText}>{t("fb.simpanDraft")}</Text>
            </Pressable>
          )}
          <Pressable
            ref={triggerRef}
            style={{ flex: 2 }}
            disabled={isSending}
            onPress={() => save(!isSelf)}
          >
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              <Text style={styles.sendText}>
                {isSending
                  ? t("umum.memproses")
                  : t(isSelf ? "fb.diriSimpan" : "fb.kirim")}
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
    errorText: {
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
      ...secondaryButtonStyle(c),
      alignItems: "center",
    },
    draftText: { fontSize: 13, fontWeight: "700", color: c.btnSoftInk },
    sendBtn: {
      ...primaryButtonStyle(c),
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
    },
    sendText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  });
