import { TourTarget } from "@/components/TourTarget";
import { useMemo } from "react";
import type { ScreenProps } from "@/navigation/types";
import {
  Keyboard,
  KeyboardAvoidingView,
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

import { Palette, primaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { ErrorState } from "@/components/ErrorState";
import { LineIcon } from "@/components/LineIcon";
import { Skeleton } from "@/components/Skeleton";
import { ICON } from "@/constants/icons";
import { useT } from "@/i18n";
import { DateSheet } from "@/components/DateSheet";
import { formatShortDateWithYear } from "@/utils/date";
import { translateServerLabel } from "@/i18n/serverLabels";
import { goBackAnimated } from "@/navigation/navigationBack";
import type { TranslationKey } from "@/i18n/id";
import { useProfileEdit } from "@/hooks/useProfileEdit";

// Nilai baku ERPNext; tampilannya mengikuti bahasa lewat terjemahkan().
const RELATIONSHIPS = [
  "Mother",
  "Father",
  "Sibling",
  "Spouse",
  "Friend",
  "Other",
];
const MAX_CONTACTS = 5;
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;
const MARITAL_NAMES: Record<(typeof MARITAL_STATUSES)[number], TranslationKey> =
  {
    Single: "api.belumMenikah",
    Married: "api.menikah",
    Divorced: "api.ceraiHidup",
    Widowed: "api.ceraiMati",
  };
const FAMILY_ROLES = [
  "Spouse",
  "Child",
  "Father",
  "Mother",
  "Sibling",
  "Other",
];
const MAX_FAMILY = 10;

export function ProfileEditScreen({ navigation }: ScreenProps) {
  const {
    profile,
    draft,
    isSending,
    loadError,
    setLoadError,
    saveError,
    setAttempt,
    update,
    percent,
    shortcomings,
    hasInvalidEmail,
    datePickerTarget,
    setDatePickerTarget,
    updateMember,
    addMember,
    removeMember,
    updateContact,
    appendContact,
    removeContact,
    isChangeRequest,
    reason,
    setReason,
    save,
  } = useProfileEdit({ navigation });
  const t = useT();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Non-HR tidak menyimpan langsung: perubahan dikirim sebagai permintaan ke HR.
  const head = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable
        style={styles.backBtn}
        onPress={() => goBackAnimated(navigation)}
      >
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>
        {t(isChangeRequest ? "pc.judulEdit" : "pe.judul")}
      </Text>
    </View>
  );

  // Formnya sengaja tidak dirender kosong selama memuat: kalau dirender,
  // pengguna bisa mulai mengetik lalu ketikannya tertimpa begitu data datang.
  if (!draft && loadError) {
    return (
      <View style={styles.container}>
        {head}
        <View style={styles.content}>
          <ErrorState
            message={loadError}
            onRetry={() => {
              setLoadError(null);
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={styles.container}>
        {head}
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Skeleton width="46%" height={12} radius={4} />
              <Skeleton width={34} height={12} radius={4} />
            </View>
            <View style={[styles.track, { marginTop: 12 }]} />
            <Skeleton
              width="76%"
              height={10}
              radius={4}
              style={{ marginTop: 12 }}
            />
          </View>

          {[0, 1].map((i) => (
            <View key={i} style={[styles.card, { marginTop: 12 }]}>
              <Skeleton width="42%" height={12} radius={4} />
              <View style={{ gap: 14, marginTop: 16 }}>
                {[0, 1, 2].map((j) => (
                  <View key={j} style={{ gap: 8 }}>
                    <Skeleton width="30%" height={10} radius={4} />
                    <Skeleton height={42} radius={14} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {head}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {isChangeRequest ? (
            <View style={styles.card}>
              <Text style={styles.noteTop}>{t("pc.catatanHr")}</Text>
              <Text style={[styles.label, { marginTop: 14 }]}>
                {t("pc.alasan")}
              </Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={reason}
                onChangeText={setReason}
                placeholder={t("pc.alasanContoh")}
                placeholderTextColor={c.mutedLabel}
                multiline
              />
            </View>
          ) : null}

          <View
            style={[styles.card, isChangeRequest ? { marginTop: 12 } : null]}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{t("pe.kelengkapan")}</Text>
              <Text style={styles.pct}>{percent}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.hint}>
              {shortcomings.length === 0
                ? t("pe.lengkap")
                : t("pe.tersisa", {
                    daftar: shortcomings
                      .map((k) => k.title.toLowerCase())
                      .join(t("pe.dan")),
                  })}
            </Text>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("pe.dataPribadi")}</Text>
            <View style={{ gap: 12, marginTop: 14 }}>
              <LockedRow
                label={t("pe.nama")}
                value={profile?.fullName ?? "—"}
              />
              <LockedRow
                label={t("pe.nik")}
                value={profile?.nikMasked ?? "—"}
              />
            </View>
            <Text style={styles.note}>{t("pe.catatanKunci")}</Text>
          </View>

          <TourTarget id="p.kontak">
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardTitle}>{t("pe.kontakAlamat")}</Text>

              <Text style={styles.label}>{t("pe.telepon")}</Text>
              <TextInput
                style={styles.input}
                value={draft?.phone ?? ""}
                onChangeText={(v) => update({ phone: v })}
                placeholder="08xx xxxx xxxx"
                placeholderTextColor={c.mutedLabel}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>{t("pe.emailPribadi")}</Text>
              <TextInput
                style={[
                  styles.input,
                  hasInvalidEmail && { borderColor: c.bad.ink },
                ]}
                value={draft?.personalEmail ?? ""}
                onChangeText={(v) => update({ personalEmail: v })}
                placeholder="nama@email.com"
                placeholderTextColor={c.mutedLabel}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {hasInvalidEmail && (
                <Text style={styles.error}>{t("pe.emailSalah")}</Text>
              )}

              <Text style={styles.label}>{t("pe.alamat")}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={draft?.address ?? ""}
                onChangeText={(v) => update({ address: v })}
                placeholder={t("pe.alamatPh")}
                placeholderTextColor={c.mutedLabel}
                multiline
              />
            </View>
          </TourTarget>

          <TourTarget id="p.darurat">
            <View style={[styles.card, { marginTop: 12 }]}>
              <Text style={styles.cardTitle}>{t("pe.kontakDarurat")}</Text>
              <Text style={styles.note}>{t("pe.kontakDesc")}</Text>

              {draft.contacts.map((k, i) => (
                <View key={i} style={styles.contactBox}>
                  <View style={styles.contactHead}>
                    <Text style={styles.contactTitle}>
                      {t("pe.kontakN", { n: i + 1 })}
                    </Text>
                    <Pressable onPress={() => removeContact(i)} hitSlop={8}>
                      <Text style={styles.removeText}>
                        {t("pe.hapusKontak")}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>{t("pe.nama2")}</Text>
                  <TextInput
                    style={styles.input}
                    value={k.name}
                    onChangeText={(v) => updateContact(i, { name: v })}
                    placeholder={t("pe.namaPh")}
                    placeholderTextColor={c.mutedLabel}
                  />

                  <Text style={styles.label}>{t("pe.hubungan")}</Text>
                  <View style={styles.chipRow}>
                    {RELATIONSHIPS.map((h) => {
                      const isOn = k.relation === h;
                      return (
                        <Pressable
                          key={h}
                          onPress={() => updateContact(i, { relation: h })}
                          style={[styles.chip, isOn && styles.chipOn]}
                        >
                          <Text
                            style={[styles.chipText, isOn && styles.chipTextOn]}
                          >
                            {translateServerLabel("relation", h)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>{t("pe.telepon")}</Text>
                  <TextInput
                    style={styles.input}
                    value={k.phone}
                    onChangeText={(v) => updateContact(i, { phone: v })}
                    placeholder="08xx xxxx xxxx"
                    placeholderTextColor={c.mutedLabel}
                    keyboardType="phone-pad"
                  />
                </View>
              ))}

              {draft.contacts.length < MAX_CONTACTS && (
                <Pressable style={styles.addContact} onPress={appendContact}>
                  <Text style={styles.addContactText}>
                    {t("pe.tambahKontak")}
                  </Text>
                </Pressable>
              )}
            </View>
          </TourTarget>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("pe.statusNikah")}</Text>
            <View style={[styles.chipRow, { marginTop: 12 }]}>
              {MARITAL_STATUSES.map((st) => {
                const isOn = draft.maritalStatus === st;
                return (
                  <Pressable
                    key={st}
                    onPress={() => update({ maritalStatus: st })}
                    style={[styles.chip, isOn && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                      {t(MARITAL_NAMES[st])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.note}>{t("pe.statusNikahCatatan")}</Text>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("pe.keluarga")}</Text>
            <Text style={styles.note}>{t("pe.keluargaDesc")}</Text>

            {draft.family.map((m, i) => (
              <View key={i} style={styles.contactBox}>
                <View style={styles.contactHead}>
                  <Text style={styles.contactTitle}>
                    {t("pe.anggotaN", { n: i + 1 })}
                  </Text>
                  <Pressable onPress={() => removeMember(i)} hitSlop={8}>
                    <Text style={styles.removeText}>{t("pe.hapusKontak")}</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>{t("pe.nama2")}</Text>
                <TextInput
                  style={styles.input}
                  value={m.name}
                  onChangeText={(v) => updateMember(i, { name: v })}
                  placeholder={t("pe.namaPh")}
                  placeholderTextColor={c.mutedLabel}
                />

                <Text style={styles.label}>{t("pe.hubungan")}</Text>
                <View style={styles.chipRow}>
                  {FAMILY_ROLES.map((h) => {
                    const isOn = m.relation === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => updateMember(i, { relation: h })}
                        style={[styles.chip, isOn && styles.chipOn]}
                      >
                        <Text
                          style={[styles.chipText, isOn && styles.chipTextOn]}
                        >
                          {translateServerLabel("relation", h)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t("pe.tglLahir")}</Text>
                <Pressable
                  style={styles.input}
                  onPress={() => {
                    Keyboard.dismiss();
                    setDatePickerTarget(i);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: m.birthDate ? c.ink : c.mutedLabel,
                    }}
                  >
                    {m.birthDate
                      ? formatShortDateWithYear(m.birthDate)
                      : t("pe.pilihTgl")}
                  </Text>
                </Pressable>

                <View style={styles.switchRow}>
                  <Text style={styles.contactTitle}>{t("pe.tanggungan")}</Text>
                  <Switch
                    value={m.dependent}
                    onValueChange={(v) => updateMember(i, { dependent: v })}
                    trackColor={{ false: c.track, true: c.accent }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            ))}

            {draft.family.length < MAX_FAMILY && (
              <Pressable style={styles.addContact} onPress={addMember}>
                <Text style={styles.addContactText}>
                  {t("pe.tambahAnggota")}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DateSheet
        visible={datePickerTarget !== null}
        title={t("pe.tglLahir")}
        hint={t("pe.tglLahirHint")}
        value={
          datePickerTarget !== null
            ? (draft.family[datePickerTarget]?.birthDate ?? null)
            : null
        }
        allow="past"
        onPick={(iso) =>
          datePickerTarget !== null &&
          updateMember(datePickerTarget, { birthDate: iso })
        }
        onClear={() =>
          datePickerTarget !== null &&
          updateMember(datePickerTarget, { birthDate: null })
        }
        onClose={() => setDatePickerTarget(null)}
      />

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.barLabel, saveError ? { color: c.bad.ink } : null]}
          >
            {saveError ??
              t(isChangeRequest ? "pc.catatanBar" : "pe.kelengkapanSetelah")}
          </Text>
          <Text style={styles.barValue}>{percent}%</Text>
        </View>
        <Pressable onPress={save} disabled={hasInvalidEmail || isSending}>
          <LinearGradient
            colors={
              hasInvalidEmail || isSending
                ? [c.track, c.track]
                : [c.accent, c.accent2]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            <Text
              style={[
                styles.saveText,
                !hasInvalidEmail && !isSending ? { color: "#fff" } : null,
              ]}
            >
              {isSending
                ? t("pw.menyimpan")
                : t(isChangeRequest ? "pc.kirim" : "pe.simpan")}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function LockedRow({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.lockedRow}>
      <Text style={styles.rowKey}>{label}</Text>
      <View style={styles.lockedValue}>
        <Text style={styles.rowValue}>{value}</Text>
        <LineIcon d={ICON.lock} color={c.mutedLabel} size={14} />
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
    pct: { fontSize: 15, fontWeight: "800", color: c.accent },

    track: {
      height: 7,
      borderRadius: 4,
      backgroundColor: c.track,
      marginTop: 11,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: 4, backgroundColor: c.accent },
    hint: {
      fontSize: 11,
      lineHeight: 17,
      fontWeight: "500",
      color: c.muted,
      marginTop: 9,
    },

    lockedRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    lockedValue: { flexDirection: "row", alignItems: "center", gap: 7 },
    rowKey: { fontSize: 12.5, fontWeight: "500", color: c.muted },
    rowValue: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    noteTop: {
      fontSize: 12,
      fontWeight: "500",
      color: c.info.ink,
      lineHeight: 18,
    },
    note: {
      fontSize: 10.5,
      lineHeight: 16,
      fontWeight: "500",
      color: c.muted,
      marginTop: 12,
    },

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
    textarea: { minHeight: 78, textAlignVertical: "top", lineHeight: 20 },
    error: {
      fontSize: 10.5,
      fontWeight: "600",
      color: c.bad.ink,
      marginTop: 6,
    },

    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
    },
    contactBox: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    contactHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    contactTitle: { fontSize: 12.5, fontWeight: "700", color: c.ink },
    removeText: { fontSize: 12, fontWeight: "700", color: c.bad.ink },
    addContact: {
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.fieldBorder,
      borderStyle: "dashed",
      alignItems: "center",
    },
    addContactText: { fontSize: 12.5, fontWeight: "700", color: c.accent },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.panelBorder,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 12, fontWeight: "600", color: c.muted },
    chipTextOn: { color: "#fff" },

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
    barLabel: { fontSize: 10.5, fontWeight: "500", color: c.muted },
    barValue: {
      fontSize: 16,
      fontWeight: "800",
      color: c.ink,
      marginTop: 3,
    },
    saveBtn: {
      ...primaryButtonStyle(c),
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 16,
    },
    saveText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
