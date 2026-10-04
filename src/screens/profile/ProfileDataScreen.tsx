import { useCallback, useMemo, useState } from "react";
import {
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
import { useSession } from "@/services/session";
import { PersonalProfile } from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";
import {
  inisial,
  kekurangan,
  persenKelengkapan,
} from "@/utils/ProfileCompleteness";
import { tanggalPendekTahun } from "@/utils/date";

export function ProfileDataScreen({ navigation }: any) {
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [profil, setProfil] = useState<PersonalProfile | null>(null);

  const muat = useCallback(() => {
    if (!employee) return;
    hrisApi.getPersonalProfile(employee.id).then(setProfil);
  }, [employee]);

  useFocusEffect(muat);

  const kurang = profil ? kekurangan(profil.editable) : [];
  const persen = profil ? persenKelengkapan(profil.editable) : 0;
  const lengkap = kurang.length === 0;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>Data Pribadi & Keluarga</Text>
      <Pressable
        style={styles.editBtn}
        onPress={() => navigation.navigate("ProfileEdit")}
      >
        <Text style={styles.editText}>Ubah</Text>
      </Pressable>
    </View>
  );

  if (!profil) {
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
  const belumDiisi = "Belum diisi";

  const seksi = [
    {
      title: "Data pribadi",
      rows: [
        ["Nama lengkap", profil.fullName],
        ["NIK", profil.nikMasked],
        [
          "Tempat, tgl lahir",
          `${profil.birthPlace}, ${tanggalPendekTahun(profil.birthDate)}`,
        ],
        ["Jenis kelamin", profil.gender],
        ["Status pernikahan", profil.maritalStatus],
        ["Agama", profil.religion],
        ["NPWP", profil.npwpMasked],
      ],
    },
    {
      title: "Kontak & alamat",
      rows: [
        ["Telepon", e.phone || belumDiisi],
        ["Email kantor", profil.workEmail],
        ["Email pribadi", e.personalEmail || belumDiisi],
        ["Alamat KTP", profil.ktpAddress],
        ["Domisili", e.address || belumDiisi],
      ],
    },
  ];

  const darurat = [
    profil.primaryEmergency,
    ...(e.em2Phone
      ? [
          {
            name: e.em2Name || "Kontak darurat",
            relation: e.em2Relation,
            phone: e.em2Phone,
          },
        ]
      : []),
  ];

  return (
    <View style={styles.container}>
      {header}

      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={[c.accent, c.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBlob} />
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Kelengkapan data</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {lengkap ? "Lengkap" : `Perlu ${kurang.length} data`}
              </Text>
            </View>
          </View>

          <Text style={styles.heroPct}>{persen}%</Text>

          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${persen}%` }]} />
          </View>

          <Text style={styles.heroNote}>
            {lengkap
              ? "Semua data sudah terisi dan terkirim ke HR"
              : `Lengkapi ${kurang.map((k) => k.judul.toLowerCase()).join(" dan ")} agar diverifikasi HR`}
          </Text>
        </LinearGradient>

        {lengkap ? (
          <View style={styles.okBanner}>
            <LineIcon d={ICON.attendanceRate} color={c.ok.ink} size={20} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.okTitle}>Data profil lengkap</Text>
              <Text style={styles.okSub}>Menunggu verifikasi HR</Text>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Belum lengkap</Text>
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
                  <Text style={styles.todoCta}>Isi</Text>
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
            <Text style={styles.cardTitle}>Keluarga</Text>
            <View style={styles.softBadge}>
              <Text style={styles.softBadgeText}>PTKP {profil.ptkpStatus}</Text>
            </View>
          </View>

          <View style={{ gap: 13, marginTop: 14 }}>
            {profil.family.map((m) => (
              <View key={m.name} style={styles.famRow}>
                <View style={styles.famAvatar}>
                  <Text style={styles.famAvatarText}>{m.initials}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.famName}>{m.name}</Text>
                  <Text style={styles.famMeta}>
                    {m.relation} · {m.age}
                  </Text>
                </View>
                <View style={styles.chipBadge}>
                  <Text style={styles.chipBadgeText}>
                    {m.dependent ? "Tanggungan" : "Non-tanggungan"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Kontak darurat</Text>
            <View style={styles.softBadge}>
              <Text style={styles.softBadgeText}>{darurat.length} kontak</Text>
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
              {e.em2Phone
                ? "Ubah kontak darurat kedua"
                : "Tambah kontak darurat"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
