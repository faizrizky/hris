import { useCallback, useMemo, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  adaLoginBiometrik,
  autentikasi,
  hapusKredensial,
  kesiapanBiometrik,
  namaBiometrik,
  simpanKredensial,
  type KesiapanBiometrik,
} from "@/services/biometrik";
import { useKunci } from "@/services/kunciApp";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConfirm } from "@/components/ConfirmDialog";
import { Palette, tombolSekunder } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { ApiError, describeError } from "@/services/api/http";
import { ErrorState } from "@/components/ErrorState";
import { useSession } from "@/services/session";
import {
  FaceState,
  FaceStatus,
  SecurityInfo,
  SecurityToggleKey,
  ActiveDevice,
} from "@/services/types";
import { RadialGlow } from "@/components/RadialGlow";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Skeleton } from "@/components/Skeleton";
import { tanggalPendekTahun } from "@/utils/date";
import { useT } from "@/i18n";
import { kembali } from "@/navigation/kembali";

// Warna pil status wajah di atas kartu gelap.
const PILL: Record<FaceState, { bg: string; ink: string }> = {
  active: { bg: "rgba(74,222,128,0.14)", ink: "#4ADE80" },
  pending: { bg: "rgba(251,191,36,0.16)", ink: "#FBBF24" },
  needs_reenroll: { bg: "rgba(251,191,36,0.16)", ink: "#FBBF24" },
  rejected: { bg: "rgba(248,113,113,0.16)", ink: "#F87171" },
  none: { bg: "rgba(148,163,184,0.18)", ink: "#CBD5E1" },
};

export function ProfileSecurityScreen({ navigation }: any) {
  const t = useT();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();

  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [wajah, setWajah] = useState<FaceStatus | null>(null);
  const kunci = useKunci();
  const [bio, setBio] = useState<KesiapanBiometrik>("siap");
  const [loginBio, setLoginBio] = useState(false);
  const [pesanBio, setPesanBio] = useState<string | null>(null);
  const [namaBio, setNamaBio] = useState("sidik jari / wajah");
  const [dialogBio, setDialogBio] = useState(false);
  const [akunBio, setAkunBio] = useState("");
  const [pwBio, setPwBio] = useState("");
  const [galatBio, setGalatBio] = useState<string | null>(null);
  const [prosesBio, setProsesBio] = useState(false);

  const muat = useCallback(() => {
    if (!employee) return;
    setGalat(null);
    hrisApi
      .getSecurityInfo(employee.id)
      .then(setInfo)
      .catch((e) => setGalat(describeError(e)));
    hrisApi
      .getFaceStatus()
      .then(setWajah)
      .catch(() => setWajah(null));
  }, [employee]);

  useFocusEffect(muat);
  useFocusEffect(
    useCallback(() => {
      kesiapanBiometrik().then(setBio);
      namaBiometrik().then(setNamaBio);
      adaLoginBiometrik().then(setLoginBio);
    }, []),
  );

  // Dua pengalih yang saling mengikat: Biometrik (login tanpa password) dan Kunci otomatis. Kunci otomatis hanya bisa
  // dinyalakan saat Biometrik aktif, dan mematikan Biometrik otomatis mematikan Kunci otomatis.
  const ubahBiometrik = async (nyala: boolean) => {
    setPesanBio(null);
    if (!nyala) {
      await hapusKredensial();
      setLoginBio(false);
      kunci.ubah({ ...kunci.pengaturan, aktif: false });
      return;
    }
    if (bio === "tidakAda") return setPesanBio(t("bio.tidakAda"));
    if (bio === "belumDaftar") return setPesanBio(t("bio.belumDaftar"));
    kunci.abaikanLatar(15_000);
    if (!(await autentikasi(t("bio.konfirmasi"), t("kunci.batal")))) return;
    setAkunBio(
      (await AsyncStorage.getItem("hris.username").catch(() => null)) ?? "",
    );
    setPwBio("");
    setGalatBio(null);
    setDialogBio(true); // password diminta satu kali untuk login biometrik
  };
  const aktifkanLoginBio = async () => {
    setProsesBio(true);
    setGalatBio(null);
    try {
      await hrisApi.login(akunBio.trim(), pwBio); // memastikan akun dan password benar
      kunci.abaikanLatar(15_000);
      await simpanKredensial(akunBio.trim(), pwBio);
      setLoginBio(true);
      setDialogBio(false);
      setPwBio("");
    } catch (e) {
      setGalatBio(
        e instanceof ApiError
          ? describeError(e)
          : t("bio.gagalSimpan", { pesan: (e as Error)?.message ?? "" }),
      );
    } finally {
      setProsesBio(false);
    }
  };

  const ubahKunci = (nyala: boolean) => {
    setPesanBio(null);
    if (nyala && !loginBio) return setPesanBio(t("bio.kunciButuhBiometrik"));
    kunci.ubah({ ...kunci.pengaturan, aktif: nyala });
  };
  const PILIHAN_TIMEOUT: [number, string][] = [
    [0, t("bio.segera")],
    [60_000, t("bio.satuMenit")],
    [300_000, t("bio.limaMenit")],
  ];

  const gagalAksi = (e: unknown) => {
    void confirm({
      title: t("umum.gagalMemproses"),
      message: describeError(e),
      tone: "bad",
      confirmText: t("umum.mengerti"),
      cancelText: null,
    });
  };

  const ubahToggle = (key: SecurityToggleKey, enabled: boolean) => {
    if (!employee) return;
    hrisApi
      .setSecurityToggle(employee.id, key, enabled)
      .then(setInfo)
      .catch(gagalAksi);
  };

  const keluarkanPerangkat = async (d: ActiveDevice) => {
    if (!employee) return;
    const ya = await confirm({
      title: t("sec.keluarkanJudul"),
      message: t("sec.keluarkanPesan", { nama: d.name }),
      tone: "bad",
      confirmText: t("sec.keluarkan"),
      cancelText: t("umum.batal"),
    });
    if (ya) {
      hrisApi
        .logoutDevice(employee.id, d.sessionIds)
        .then(setInfo)
        .catch(gagalAksi);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable style={styles.backBtn} onPress={() => kembali(navigation)}>
        <Ionicons name="chevron-back" size={18} color={c.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>{t("sec.judul")}</Text>
    </View>
  );

  if (!info) {
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
                {wajah ? t(`sec.wajahSub.${wajah.state}` as never) : "…"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.onDark.muted} />
          </View>

          {wajah ? (
            <View style={styles.facePills}>
              <View
                style={[styles.pill, { backgroundColor: PILL[wajah.state].bg }]}
              >
                <Text
                  style={[styles.pillText, { color: PILL[wajah.state].ink }]}
                >
                  {t(`sec.wajah.${wajah.state}` as never)}
                </Text>
              </View>
              {wajah.state === "needs_reenroll" && wajah.graceUntil ? (
                <View
                  style={[styles.pill, { backgroundColor: PILL.pending.bg }]}
                >
                  <Text style={[styles.pillText, { color: PILL.pending.ink }]}>
                    {t("sec.batas", {
                      tgl: tanggalPendekTahun(wajah.graceUntil),
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("sec.keamananAkun")}</Text>

          <Text style={styles.grupLabel}>{t("sec.grupBiometrik")}</Text>
          <View style={styles.baris}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>
                {t("bio.loginBio", { nama: namaBio })}
              </Text>
              <Text style={styles.rowSub}>
                {loginBio ? t("bio.loginBioAktif") : t("bio.loginBioMati")}
              </Text>
            </View>
            <Switch
              value={loginBio}
              onValueChange={ubahBiometrik}
              trackColor={{ false: c.track, true: c.accent }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.baris, !loginBio && { opacity: 0.45 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{t("bio.kunciOtomatis")}</Text>
              <Text style={styles.rowSub}>
                {loginBio
                  ? t("bio.kunciSub", { nama: namaBio })
                  : t("bio.kunciButuhBiometrik")}
              </Text>
            </View>
            <Switch
              value={loginBio && kunci.pengaturan.aktif}
              onValueChange={ubahKunci}
              disabled={!loginBio}
              trackColor={{ false: c.track, true: c.accent }}
              thumbColor="#fff"
            />
          </View>
          {loginBio && kunci.pengaturan.aktif ? (
            <View style={{ paddingVertical: 8 }}>
              <Text style={styles.rowSub}>{t("bio.timeout")}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {PILIHAN_TIMEOUT.map(([ms, label]) => {
                  const on = kunci.pengaturan.timeoutMs === ms;
                  return (
                    <Pressable
                      key={ms}
                      onPress={() =>
                        kunci.ubah({ ...kunci.pengaturan, timeoutMs: ms })
                      }
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: on ? c.accent : c.fieldBorder,
                        backgroundColor: on ? c.accent : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: "600",
                          color: on ? "#fff" : c.ink,
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
          {pesanBio ? (
            <Text style={[styles.rowSub, { color: c.bad.ink, marginTop: 8 }]}>
              {pesanBio}
            </Text>
          ) : null}

          <Text style={[styles.grupLabel, { marginTop: 18 }]}>
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
          {info.toggles.map((tg, i) => (
            <View
              key={tg.key}
              style={[
                styles.baris,
                i === info.toggles.length - 1 && styles.barisAkhir,
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>{tg.title}</Text>
                <Text style={styles.rowSub}>{tg.subtitle}</Text>
              </View>
              <Switch
                value={tg.enabled}
                onValueChange={(v) => ubahToggle(tg.key, v)}
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
                    onPress={() => keluarkanPerangkat(d)}
                    hitSlop={8}
                    style={styles.devKeluar}
                  >
                    <Text style={styles.devKeluarText}>
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
        visible={dialogBio}
        transparent
        animationType="fade"
        onRequestClose={() => setDialogBio(false)}
      >
        <View style={styles.modalLatar}>
          <View style={styles.modalKartu}>
            <Text style={styles.cardTitle}>
              {t("bio.pwJudul", { nama: namaBio })}
            </Text>
            <Text style={[styles.rowSub, { marginTop: 6 }]}>
              {t("bio.pwSub", { nama: namaBio })}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={akunBio}
              onChangeText={setAkunBio}
              placeholder={t("bio.akun")}
              placeholderTextColor={c.mutedLabel}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.modalInput}
              value={pwBio}
              onChangeText={setPwBio}
              placeholder={t("bio.password")}
              placeholderTextColor={c.mutedLabel}
              secureTextEntry
              autoCapitalize="none"
            />
            {galatBio ? (
              <Text style={[styles.rowSub, { color: c.bad.ink, marginTop: 8 }]}>
                {galatBio}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                style={[
                  styles.modalTombol,
                  {
                    ...tombolSekunder(c),
                  },
                ]}
                onPress={() => setDialogBio(false)}
                disabled={prosesBio}
              >
                <Text style={{ fontWeight: "700", color: c.btnSoftInk }}>
                  {t("kunci.batal")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalTombol,
                  {
                    backgroundColor: c.accent,
                    opacity: akunBio && pwBio ? 1 : 0.5,
                  },
                ]}
                onPress={aktifkanLoginBio}
                disabled={prosesBio || !akunBio || !pwBio}
              >
                {prosesBio ? (
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

    grupLabel: {
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
    barisAkhir: { borderBottomWidth: 0 },
    modalLatar: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalKartu: {
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
    modalTombol: {
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

    devKeluar: {
      borderWidth: 1,
      borderColor: c.bad.ink,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      marginRight: 6,
    },
    devKeluarText: { fontSize: 11, fontWeight: "700", color: c.bad.ink },
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
