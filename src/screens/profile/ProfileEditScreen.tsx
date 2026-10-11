import { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { ErrorState } from "@/components/ErrorState";
import { useSession } from "@/services/session";
import {
  EditableProfile,
  EmergencyContact,
  FamilyMember,
  PersonalProfile,
} from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { Skeleton } from "@/components/Skeleton";
import { ICON } from "@/constants/icons";
import {
  emailValid,
  kekurangan,
  persenKelengkapan,
  teleponValid,
} from "@/utils/ProfileCompleteness";
import { useT } from "@/i18n";
import { DateSheet } from "@/components/DateSheet";
import { tanggalPendekTahun } from "@/utils/date";
import { terjemahkan } from "@/i18n/serverLabels";
import { useConfirm } from "@/components/ConfirmDialog";

// Nilai baku ERPNext; tampilannya mengikuti bahasa lewat terjemahkan().
const HUBUNGAN = ["Mother", "Father", "Sibling", "Spouse", "Friend", "Other"];
const MAKS_KONTAK = 5;
const KELUARGA = ["Spouse", "Child", "Father", "Mother", "Sibling", "Other"];
const MAKS_KELUARGA = 10;

export function ProfileEditScreen({ navigation }: any) {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [profil, setProfil] = useState<PersonalProfile | null>(null);
  const [draft, setDraft] = useState<EditableProfile | null>(null);
  const [sending, setSending] = useState(false);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [galatSimpan, setGalatSimpan] = useState<string | null>(null);
  const [coba, setCoba] = useState(0); // naik saat Coba lagi ditekan

  useEffect(() => {
    if (!employee) return;
    hrisApi
      .getPersonalProfile(employee.id)
      .then((p) => {
        setProfil(p);
        // Draft terpisah dari data tersimpan: perubahan baru berlaku saat disimpan.
        setDraft(p.editable);
      })
      .catch((e) => setGalatMuat(describeError(e)));
  }, [employee, coba]);

  const ubah = (patch: Partial<EditableProfile>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const persen = draft ? persenKelengkapan(draft) : 0;
  const kurang = draft ? kekurangan(draft) : [];
  const emailSalah = !!draft?.personalEmail && !emailValid(draft.personalEmail);

  const [pilihTgl, setPilihTgl] = useState<number | null>(null);
  const ubahAnggota = (i: number, patch: Partial<FamilyMember>) =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            family: prev.family.map((m, j) =>
              j === i ? { ...m, ...patch } : m,
            ),
          }
        : prev,
    );
  const tambahAnggota = () =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            family: [
              ...prev.family,
              {
                name: "",
                relation: "Child",
                birthDate: null,
                dependent: false,
              },
            ],
          }
        : prev,
    );
  const hapusAnggota = (i: number) =>
    setDraft((prev) =>
      prev ? { ...prev, family: prev.family.filter((_, j) => j !== i) } : prev,
    );

  const ubahKontak = (i: number, patch: Partial<EmergencyContact>) =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            contacts: prev.contacts.map((k, j) =>
              j === i ? { ...k, ...patch } : k,
            ),
          }
        : prev,
    );
  const tambahKontak = () =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            contacts: [
              ...prev.contacts,
              { name: "", relation: "Other", phone: "" },
            ],
          }
        : prev,
    );
  const hapusKontak = (i: number) =>
    setDraft((prev) =>
      prev
        ? { ...prev, contacts: prev.contacts.filter((_, j) => j !== i) }
        : prev,
    );

  // Non-HR tidak menyimpan langsung: perubahan dikirim sebagai permintaan ke HR.
  const ajuan = !!profil && !profil.canEditDirectly;
  const [alasan, setAlasan] = useState("");

  const simpan = async () => {
    if (!employee || !draft || emailSalah) return;
    if (ajuan && !alasan.trim()) {
      setGalatSimpan(t("pc.alasanWajib"));
      return;
    }
    // Baris yang benar-benar kosong dibuang; yang setengah terisi harus dilengkapi.
    const kontak = draft.contacts.filter(
      (k) => k.name.trim() || k.phone.trim(),
    );
    if (kontak.some((k) => !k.name.trim() || !teleponValid(k.phone))) {
      setGalatSimpan(t("pe.kontakTidakLengkap"));
      return;
    }
    if (draft.family.some((m) => !m.name.trim())) {
      setGalatSimpan(t("pe.keluargaTidakLengkap"));
      return;
    }
    setSending(true);
    setGalatSimpan(null);
    try {
      const data = { ...draft, contacts: kontak };
      if (ajuan) {
        await hrisApi.submitProfileChange(data, alasan.trim());
        await confirm({
          title: t("pc.terkirimJudul"),
          message: t("pc.terkirimPesan"),
          tone: "info",
          confirmText: t("umum.mengerti"),
          cancelText: null,
        });
      } else {
        await hrisApi.savePersonalProfile(employee.id, data);
      }
      navigation.goBack();
    } catch (e) {
      setGalatSimpan(describeError(e));
    } finally {
      setSending(false);
    }
  };

  const head = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>
        {t(ajuan ? "pc.judulEdit" : "pe.judul")}
      </Text>
    </View>
  );

  // Formnya sengaja tidak dirender kosong selama memuat: kalau dirender,
  // pengguna bisa mulai mengetik lalu ketikannya tertimpa begitu data datang.
  if (!draft && galatMuat) {
    return (
      <View style={styles.container}>
        {head}
        <View style={styles.content}>
          <ErrorState
            pesan={galatMuat}
            onUlangi={() => {
              setGalatMuat(null);
              setCoba((n) => n + 1);
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {ajuan ? (
            <View style={styles.card}>
              <Text style={styles.noteTop}>{t("pc.catatanHr")}</Text>
              <Text style={[styles.label, { marginTop: 14 }]}>
                {t("pc.alasan")}
              </Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={alasan}
                onChangeText={setAlasan}
                placeholder={t("pc.alasanContoh")}
                placeholderTextColor={c.mutedLabel}
                multiline
              />
            </View>
          ) : null}

          <View style={[styles.card, ajuan ? { marginTop: 12 } : null]}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{t("pe.kelengkapan")}</Text>
              <Text style={styles.pct}>{persen}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${persen}%` }]} />
            </View>
            <Text style={styles.hint}>
              {kurang.length === 0
                ? t("pe.lengkap")
                : t("pe.tersisa", {
                    daftar: kurang
                      .map((k) => k.judul.toLowerCase())
                      .join(t("pe.dan")),
                  })}
            </Text>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("pe.dataPribadi")}</Text>
            <View style={{ gap: 12, marginTop: 14 }}>
              <LockedRow label={t("pe.nama")} value={profil?.fullName ?? "—"} />
              <LockedRow label={t("pe.nik")} value={profil?.nikMasked ?? "—"} />
            </View>
            <Text style={styles.note}>{t("pe.catatanKunci")}</Text>
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("pe.kontakAlamat")}</Text>

            <Text style={styles.label}>{t("pe.telepon")}</Text>
            <TextInput
              style={styles.input}
              value={draft?.phone ?? ""}
              onChangeText={(v) => ubah({ phone: v })}
              placeholder="08xx xxxx xxxx"
              placeholderTextColor={c.mutedLabel}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t("pe.emailPribadi")}</Text>
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
              <Text style={styles.error}>{t("pe.emailSalah")}</Text>
            )}

            <Text style={styles.label}>{t("pe.alamat")}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={draft?.address ?? ""}
              onChangeText={(v) => ubah({ address: v })}
              placeholder={t("pe.alamatPh")}
              placeholderTextColor={c.mutedLabel}
              multiline
            />
          </View>

          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("pe.kontakDarurat")}</Text>
            <Text style={styles.note}>{t("pe.kontakDesc")}</Text>

            {draft.contacts.map((k, i) => (
              <View key={i} style={styles.contactBox}>
                <View style={styles.contactHead}>
                  <Text style={styles.contactTitle}>
                    {t("pe.kontakN", { n: i + 1 })}
                  </Text>
                  <Pressable onPress={() => hapusKontak(i)} hitSlop={8}>
                    <Text style={styles.removeText}>{t("pe.hapusKontak")}</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>{t("pe.nama2")}</Text>
                <TextInput
                  style={styles.input}
                  value={k.name}
                  onChangeText={(v) => ubahKontak(i, { name: v })}
                  placeholder={t("pe.namaPh")}
                  placeholderTextColor={c.mutedLabel}
                />

                <Text style={styles.label}>{t("pe.hubungan")}</Text>
                <View style={styles.chipRow}>
                  {HUBUNGAN.map((h) => {
                    const on = k.relation === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => ubahKontak(i, { relation: h })}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text
                          style={[styles.chipText, on && styles.chipTextOn]}
                        >
                          {terjemahkan("relation", h)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t("pe.telepon")}</Text>
                <TextInput
                  style={styles.input}
                  value={k.phone}
                  onChangeText={(v) => ubahKontak(i, { phone: v })}
                  placeholder="08xx xxxx xxxx"
                  placeholderTextColor={c.mutedLabel}
                  keyboardType="phone-pad"
                />
              </View>
            ))}

            {draft.contacts.length < MAKS_KONTAK && (
              <Pressable style={styles.addContact} onPress={tambahKontak}>
                <Text style={styles.addContactText}>
                  {t("pe.tambahKontak")}
                </Text>
              </Pressable>
            )}
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
                  <Pressable onPress={() => hapusAnggota(i)} hitSlop={8}>
                    <Text style={styles.removeText}>{t("pe.hapusKontak")}</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>{t("pe.nama2")}</Text>
                <TextInput
                  style={styles.input}
                  value={m.name}
                  onChangeText={(v) => ubahAnggota(i, { name: v })}
                  placeholder={t("pe.namaPh")}
                  placeholderTextColor={c.mutedLabel}
                />

                <Text style={styles.label}>{t("pe.hubungan")}</Text>
                <View style={styles.chipRow}>
                  {KELUARGA.map((h) => {
                    const on = m.relation === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => ubahAnggota(i, { relation: h })}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text
                          style={[styles.chipText, on && styles.chipTextOn]}
                        >
                          {terjemahkan("relation", h)}
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
                    setPilihTgl(i);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: m.birthDate ? c.ink : c.mutedLabel,
                    }}
                  >
                    {m.birthDate
                      ? tanggalPendekTahun(m.birthDate)
                      : t("pe.pilihTgl")}
                  </Text>
                </Pressable>

                <View style={styles.switchRow}>
                  <Text style={styles.contactTitle}>{t("pe.tanggungan")}</Text>
                  <Switch
                    value={m.dependent}
                    onValueChange={(v) => ubahAnggota(i, { dependent: v })}
                    trackColor={{ false: c.track, true: c.accent }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            ))}

            {draft.family.length < MAKS_KELUARGA && (
              <Pressable style={styles.addContact} onPress={tambahAnggota}>
                <Text style={styles.addContactText}>
                  {t("pe.tambahAnggota")}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DateSheet
        visible={pilihTgl !== null}
        title={t("pe.tglLahir")}
        hint={t("pe.tglLahirHint")}
        value={
          pilihTgl !== null ? (draft.family[pilihTgl]?.birthDate ?? null) : null
        }
        allow="past"
        onPick={(iso) =>
          pilihTgl !== null && ubahAnggota(pilihTgl, { birthDate: iso })
        }
        onClear={() =>
          pilihTgl !== null && ubahAnggota(pilihTgl, { birthDate: null })
        }
        onClose={() => setPilihTgl(null)}
      />

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.barLabel, galatSimpan ? { color: c.bad.ink } : null]}
          >
            {galatSimpan ??
              t(ajuan ? "pc.catatanBar" : "pe.kelengkapanSetelah")}
          </Text>
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
              {sending
                ? t("pw.menyimpan")
                : t(ajuan ? "pc.kirim" : "pe.simpan")}
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
    saveBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16 },
    saveText: { fontSize: 13.5, fontWeight: "700", color: c.mutedLabel },
  });
