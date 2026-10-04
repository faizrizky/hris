import { useEffect, useMemo, useState } from "react";
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
import { useSession } from "@/services/session";
import { EditableProfile, PersonalProfile } from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { Skeleton } from "@/components/Skeleton";
import { ICON } from "@/constants/icons";
import {
  emailValid,
  kekurangan,
  persenKelengkapan,
} from "@/utils/ProfileCompleteness";

const HUBUNGAN = ["Ibu", "Saudara", "Teman", "Lainnya"];

export function ProfileEditScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [profil, setProfil] = useState<PersonalProfile | null>(null);
  const [draft, setDraft] = useState<EditableProfile | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getPersonalProfile(employee.id).then((p) => {
      setProfil(p);
      // Draft terpisah dari data tersimpan: perubahan baru berlaku saat disimpan.
      setDraft(p.editable);
    });
  }, [employee]);

  const ubah = (patch: Partial<EditableProfile>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const persen = draft ? persenKelengkapan(draft) : 0;
  const kurang = draft ? kekurangan(draft) : [];
  const emailSalah = !!draft?.personalEmail && !emailValid(draft.personalEmail);

  const simpan = async () => {
    if (!employee || !draft || emailSalah) return;
    setSending(true);
    try {
      await hrisApi.savePersonalProfile(employee.id, draft);
      navigation.goBack();
    } finally {
      setSending(false);
    }
  };

  const head = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>Ubah Data</Text>
    </View>
  );

  // Formnya sengaja tidak dirender kosong selama memuat: kalau dirender,
  // pengguna bisa mulai mengetik lalu ketikannya tertimpa begitu data datang.
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
              <Text style={styles.cardTitle}>Kelengkapan data</Text>
              <Text style={styles.pct}>{persen}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${persen}%` }]} />
            </View>
            <Text style={styles.hint}>
              {kurang.length === 0
                ? "Semua data sudah terisi. Simpan untuk mengirim ke HR."
                : `Tersisa ${kurang.map((k) => k.judul.toLowerCase()).join(" dan ")}.`}
            </Text>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>Data pribadi</Text>
            <View style={{ gap: 12, marginTop: 14 }}>
              <LockedRow label="Nama lengkap" value={profil?.fullName ?? "—"} />
              <LockedRow label="NIK" value={profil?.nikMasked ?? "—"} />
            </View>
            <Text style={styles.note}>
              Nama dan NIK hanya dapat diubah oleh HR melalui pengajuan dokumen.
            </Text>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>Kontak & alamat</Text>

            <Text style={styles.label}>Telepon</Text>
            <TextInput
              style={styles.input}
              value={draft?.phone ?? ""}
              onChangeText={(v) => ubah({ phone: v })}
              placeholder="08xx xxxx xxxx"
              placeholderTextColor={c.mutedLabel}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Email pribadi</Text>
            <TextInput
              style={[styles.input, emailSalah && { borderColor: c.bad.ink }]}
              value={draft?.personalEmail ?? ""}
              onChangeText={(v) => ubah({ personalEmail: v })}
              placeholder="nama@email.com"
              placeholderTextColor={c.mutedLabel}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {emailSalah && (
              <Text style={styles.error}>Format email belum sesuai</Text>
            )}

            <Text style={styles.label}>Alamat domisili</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={draft?.address ?? ""}
              onChangeText={(v) => ubah({ address: v })}
              placeholder="Alamat lengkap"
              placeholderTextColor={c.mutedLabel}
              multiline
            />
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>Kontak darurat kedua</Text>

            <Text style={styles.label}>Nama</Text>
            <TextInput
              style={styles.input}
              value={draft?.em2Name ?? ""}
              onChangeText={(v) => ubah({ em2Name: v })}
              placeholder="Nama lengkap"
              placeholderTextColor={c.mutedLabel}
            />

            <Text style={styles.label}>Hubungan</Text>
            <View style={styles.chipRow}>
              {HUBUNGAN.map((h) => {
                const on = draft?.em2Relation === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => ubah({ em2Relation: h })}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {h}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Telepon</Text>
            <TextInput
              style={styles.input}
              value={draft?.em2Phone ?? ""}
              onChangeText={(v) => ubah({ em2Phone: v })}
              placeholder="08xx xxxx xxxx"
              placeholderTextColor={c.mutedLabel}
              keyboardType="phone-pad"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.barLabel}>Kelengkapan setelah disimpan</Text>
          <Text style={styles.barValue}>{persen}%</Text>
        </View>
        <Pressable onPress={simpan} disabled={emailSalah || sending}>
          <LinearGradient
            colors={
              emailSalah || sending ? [c.track, c.track] : [c.accent, c.accent2]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            <Text
              style={[
                styles.saveText,
                !emailSalah && !sending ? { color: "#fff" } : null,
              ]}
            >
              {sending ? "Menyimpan..." : "Simpan perubahan"}
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
    saveBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16 },
    saveText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
