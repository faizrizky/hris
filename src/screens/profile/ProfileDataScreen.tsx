import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { ErrorState } from "@/components/ErrorState";
import { useSession } from "@/services/session";
import { PersonalProfile, ProfileChange } from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";
import {
  inisial,
  kekurangan,
  persenKelengkapan,
} from "@/utils/ProfileCompleteness";
import { tahunSejak, tanggalPendekTahun } from "@/utils/date";
import { useT } from "@/i18n";
import { ChangeSummary } from "@/screens/profile/ChangeSummary";
import { terjemahkan } from "@/i18n/serverLabels";
import { kembali } from "@/navigation/kembali";
import { useFotoProfil } from "@/hooks/useFotoProfil";

export function ProfileDataScreen({ navigation }: any) {
  const t = useT();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [profil, setProfil] = useState<PersonalProfile | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [permintaan, setPermintaan] = useState<ProfileChange[]>([]);
  const foto = useFotoProfil();

  const muat = useCallback(() => {
    if (!employee) return;
    setGalat(null);
    hrisApi
      .getPersonalProfile(employee.id)
      .then((p) => {
        setProfil(p);
        // Riwayat permintaan hanya relevan bagi yang tidak mengubah langsung.
        if (!p.canEditDirectly) {
          hrisApi
            .getMyProfileChanges()
            .then(setPermintaan)
            .catch(() => setPermintaan([]));
        }
      })
      .catch((e) => setGalat(describeError(e)));
  }, [employee]);

  useFocusEffect(muat);

  const kurang = profil ? kekurangan(profil.editable) : [];
  const persen = profil ? persenKelengkapan(profil.editable) : 0;
  const lengkap = kurang.length === 0;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>{t("pd.judul")}</Text>
      <Pressable
        style={styles.editBtn}
        onPress={() => navigation.navigate("ProfileEdit")}
      >
        <Text style={styles.editText}>
          {t(profil && !profil.canEditDirectly ? "pc.ajukan" : "pd.ubah")}
        </Text>
      </Pressable>
    </View>
  );

  if (!profil) {
    if (galat) {
      return (
        <View style={styles.container}>
          {header}
          <View style={styles.content}>
            <ErrorState pesan={galat} onUlangi={muat} />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          <Skeleton width="100%" height={150} radius={22} />
          <Skeleton
            width="100%"
            height={180}
            radius={22}
            style={{ marginTop: 12 }}
          />
        </View>
      </View>
    );
  }

  const e = profil.editable;
  const belumDiisi = t("pd.belumDiisi");

  const seksi = [
    {
      title: t("pd.dataPribadi"),
      rows: [
        [t("pd.nama"), profil.fullName],
        [t("pd.nik"), profil.nikMasked],
        [
          t("pd.ttl"),
          [
            profil.birthPlace !== "—" ? profil.birthPlace : null,
            profil.birthDate ? tanggalPendekTahun(profil.birthDate) : null,
          ]
            .filter(Boolean)
            .join(", ") || "—",
        ],
        [t("pd.gender"), profil.gender],
        [t("pd.nikah"), profil.maritalStatus],
        [t("pd.agama"), profil.religion],
        [t("pd.npwp"), profil.npwpMasked],
      ],
    },
    {
      title: t("pd.kontakAlamat"),
      rows: [
        [t("pd.telepon"), e.phone || belumDiisi],
        [t("pd.emailKantor"), profil.workEmail],
        [t("pd.emailPribadi"), e.personalEmail || belumDiisi],
        [t("pd.alamatKtp"), profil.ktpAddress],
        [t("pd.domisili"), e.address || belumDiisi],
      ],
    },
  ];

  const darurat = [
    profil.primaryEmergency,
    ...e.contacts.map((k) => ({
      ...k,
      relation: terjemahkan("relation", k.relation),
    })),
  ];

  return (
    <View style={styles.container}>
      {header}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, styles.photoCard]}>
          {foto ? (
            <Image source={{ uri: foto }} style={styles.photo} />
          ) : (
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.photo}
            >
              <Text style={styles.photoInitial}>
                {inisial(profil.fullName)}
              </Text>
            </LinearGradient>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle}>{t("pd.fotoProfil")}</Text>
            <Text style={styles.famMeta}>
              {foto ? t("pd.fotoAda") : t("pd.fotoBelum")}
            </Text>
          </View>
          <Pressable
            style={styles.photoBtn}
            onPress={() => navigation.navigate("ProfilePhoto")}
          >
            <Text style={styles.addBtnText}>{t("pd.ubahFoto")}</Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={[c.accent, c.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { marginTop: 12 }]}
        >
          <View style={styles.heroBlob} />
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>{t("pd.kelengkapan")}</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {lengkap
                  ? t("pd.lengkap")
                  : t("pd.perluN", { n: kurang.length })}
              </Text>
            </View>
          </View>

          <Text style={styles.heroPct}>{persen}%</Text>

          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${persen}%` }]} />
          </View>

          <Text style={styles.heroNote}>
            {lengkap
              ? t("pd.noteLengkap")
              : t("pd.noteKurang", {
                  daftar: kurang
                    .map((k) => k.judul.toLowerCase())
                    .join(t("pe.dan")),
                })}
          </Text>
        </LinearGradient>

        {profil.pendingChange ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingText}>{t("pc.menunggu")}</Text>
          </View>
        ) : null}

        {permintaan.length > 0 ? (
          <View style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{t("pc.riwayat")}</Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              {permintaan.slice(0, 5).map((p) => (
                <ChangeSummary key={p.id} p={p} />
              ))}
            </View>
          </View>
        ) : null}

        {lengkap ? (
          <View style={styles.okBanner}>
            <LineIcon d={ICON.attendanceRate} color={c.ok.ink} size={20} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.okTitle}>{t("pd.okTitle")}</Text>
              <Text style={styles.okSub}>{t("pd.okSub")}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("pd.belumLengkap")}</Text>
            <View style={{ gap: 10, marginTop: 12 }}>
              {kurang.map((k) => (
                <Pressable
                  key={k.judul}
                  style={styles.todoRow}
                  onPress={() => navigation.navigate("ProfileEdit")}
                >
                  <LineIcon d={ICON.late} color={c.warn.ink} size={17} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.todoTitle}>{k.judul}</Text>
                    <Text style={styles.todoSub}>{k.alasan}</Text>
                  </View>
                  <Text style={styles.todoCta}>{t("pd.isi")}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {seksi.map((s) => (
          <View key={s.title} style={[styles.card, { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <View style={{ gap: 12, marginTop: 14 }}>
              {s.rows.map(([k, v]) => (
                <View key={k} style={styles.row}>
                  <Text style={styles.rowKey}>{k}</Text>
                  <Text
                    style={[
                      styles.rowValue,
                      v === belumDiisi && { color: c.warn.ink },
                    ]}
                  >
                    {v}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t("pd.keluarga")}</Text>
            <View style={styles.softBadge}>
              <Text style={styles.softBadgeText}>PTKP {profil.ptkpStatus}</Text>
            </View>
          </View>

          <View style={{ gap: 13, marginTop: 14 }}>
            {e.family.length === 0 ? (
              <Text style={styles.famMeta}>{t("pd.keluargaKosong")}</Text>
            ) : (
              e.family.map((m, i) => (
                <View key={`${m.name}-${i}`} style={styles.famRow}>
                  <View style={styles.famAvatar}>
                    <Text style={styles.famAvatarText}>{inisial(m.name)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.famName}>{m.name}</Text>
                    <Text style={styles.famMeta}>
                      {terjemahkan("relation", m.relation)}
                      {m.birthDate
                        ? ` · ${t("pd.umur", { n: tahunSejak(m.birthDate) })}`
                        : ""}
                    </Text>
                  </View>
                  <View style={styles.chipBadge}>
                    <Text style={styles.chipBadgeText}>
                      {m.dependent ? t("pd.tanggungan") : t("pd.nonTanggungan")}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <Pressable
            style={styles.addBtn}
            onPress={() => navigation.navigate("ProfileEdit")}
          >
            <Text style={styles.addBtnText}>
              {e.family.length ? t("pd.ubahKeluarga") : t("pd.tambahKeluarga")}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t("pd.kontakDarurat")}</Text>
            <View style={styles.softBadge}>
              <Text style={styles.softBadgeText}>
                {t("pd.nKontak", { n: darurat.length })}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 6 }}>
            {darurat.map((k) => (
              <View key={k.phone} style={styles.emRow}>
                <View style={styles.emAvatar}>
                  <Text style={styles.emAvatarText}>{inisial(k.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.emNameRow}>
                    <Text style={styles.emName}>{k.name}</Text>
                    <View style={styles.chipBadge}>
                      <Text style={styles.chipBadgeText}>{k.relation}</Text>
                    </View>
                  </View>
                  <Text style={styles.emPhone}>{k.phone}</Text>
                </View>
                <Pressable
                  style={styles.callBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${k.phone.replace(/\s/g, "")}`)
                  }
                >
                  <LineIcon d={ICON.phone} color={c.ok.ink} size={16} />
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable
            style={styles.addBtn}
            onPress={() => navigation.navigate("ProfileEdit")}
          >
            <Text style={styles.addBtnText}>
              {e.contacts.length ? t("pd.ubahKontak2") : t("pd.tambahKontak")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    pendingBanner: {
      marginTop: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: c.warn.bg,
    },
    pendingText: { fontSize: 12, fontWeight: "700", color: c.warn.ink },
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
    headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: c.ink },
    editBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.accent,
    },
    editText: { fontSize: 11.5, fontWeight: "600", color: "#fff" },

    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 130 },

    hero: { borderRadius: 22, padding: 18, overflow: "hidden" },
    photoCard: {
      marginTop: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    photo: {
      width: 60,
      height: 60,
      borderRadius: 30,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    photoInitial: { fontSize: 19, fontWeight: "800", color: "#fff" },
    photoBtn: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.chip,
    },
    heroBlob: {
      position: "absolute",
      right: -40,
      top: -50,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: c.onDark.surface,
    },
    heroTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: c.onDark.ink,
    },
    heroBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.onDark.pill,
    },
    heroBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    heroPct: {
      fontSize: 34,
      lineHeight: 36,
      fontWeight: "800",
      letterSpacing: -1.2,
      color: "#fff",
      marginTop: 10,
    },
    heroTrack: {
      height: 7,
      borderRadius: 4,
      backgroundColor: c.onDark.pill,
      marginTop: 13,
      overflow: "hidden",
    },
    heroFill: { height: "100%", borderRadius: 4, backgroundColor: "#fff" },
    heroNote: {
      fontSize: 11,
      fontWeight: "500",
      color: c.onDark.ink,
      marginTop: 9,
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
    cardHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    cardTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },

    okBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.ok.bg,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginTop: 12,
    },
    okTitle: { fontSize: 12.5, fontWeight: "700", color: c.ok.ink },
    okSub: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.ok.ink,
      marginTop: 2,
      opacity: 0.9,
    },

    todoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: c.warn.bg,
    },
    todoTitle: { fontSize: 12.5, fontWeight: "700", color: c.warn.ink },
    todoSub: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.warn.ink,
      marginTop: 2,
      opacity: 0.85,
    },
    todoCta: { fontSize: 11.5, fontWeight: "700", color: c.warn.ink },

    row: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
    rowKey: { fontSize: 12.5, fontWeight: "500", color: c.muted },
    rowValue: {
      flexShrink: 1,
      fontSize: 12.5,
      lineHeight: 18,
      fontWeight: "600",
      color: c.ink,
      textAlign: "right",
    },

    softBadge: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.info.bg,
    },
    softBadgeText: { fontSize: 10, fontWeight: "700", color: c.info.ink },
    chipBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
      backgroundColor: c.chip,
    },
    chipBadgeText: { fontSize: 9.5, fontWeight: "700", color: c.muted },

    famRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    famAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    famAvatarText: { fontSize: 12, fontWeight: "700", color: c.info.ink },
    famName: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    famMeta: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    emRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    emAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.bad.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    emAvatarText: { fontSize: 12.5, fontWeight: "700", color: c.bad.ink },
    emNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    emName: { fontSize: 12.5, fontWeight: "600", color: c.ink },
    emPhone: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },
    callBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.ok.bg,
      alignItems: "center",
      justifyContent: "center",
    },

    addBtn: {
      marginTop: 12,
      paddingVertical: 11,
      borderRadius: 13,
      backgroundColor: c.chip,
      alignItems: "center",
    },
    addBtnText: { fontSize: 12, fontWeight: "700", color: c.accent },
  });
