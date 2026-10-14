import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RadialGlow } from "@/components/RadialGlow";
import { Skeleton } from "@/components/Skeleton";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme, useThemeMode } from "@/theme/ThemeContext";
import { tahunSejak } from "@/utils/date";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveBalance } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useT } from "@/i18n";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useFotoProfil } from "@/hooks/useFotoProfil";

export function ProfileScreen({ navigation }: any) {
  const { employee, setEmployee } = useSession();
  const insets = useSafeAreaInsets();
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [pushOn, setPushOn] = useState(true);
  const { mode, toggle } = useThemeMode();
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const confirm = useConfirm();
  const keluarRef = useRef<View>(null);
  const foto = useFotoProfil();
  // Foto memudar masuk sambil sedikit mengecil, selaras animasi halaman lain.
  const [fotoMuncul] = useState(() => new Animated.Value(0));
  const munculkanFoto = () =>
    Animated.timing(fotoMuncul, {
      toValue: 1,
      duration: 520,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();

  useEffect(() => {
    if (!employee) return;
    hrisApi
      .getLeaveBalances(employee.id)
      .then(setBalances)
      // Saldo hanya satu statistik di kepala halaman; kalau gagal, layar tetap
      // berguna (menu, keluar), jadi tampilkan kosong, bukan skeleton selamanya.
      .catch(() => setBalances([]));
  }, [employee]);

  if (!employee) return null;

  const cuti = (balances ?? []).find((b) => b.type === "cuti");

  return (
    <View style={styles.container}>
      {foto ? (
        <View style={[styles.photoHero, { height: 340 + insets.top }]}>
          <Animated.Image
            source={{ uri: foto }}
            onLoad={munculkanFoto}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: fotoMuncul,
                transform: [
                  {
                    scale: fotoMuncul.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1.06, 1],
                    }),
                  },
                ],
              },
            ]}
          />
          <LinearGradient
            colors={["transparent", c.headerBg]}
            locations={[0.35, 0.95]}
            style={StyleSheet.absoluteFill}
          />
          <RadialGlow
            size={260}
            color={c.glowHeader}
            bottom={-120}
            left={-80}
          />
          <View style={styles.photoInfo}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.photoName} numberOfLines={2}>
                {employee.fullName}
              </Text>
              <View style={styles.photoMeta}>
                <Text style={styles.role} numberOfLines={1}>
                  {employee.jobTitle} · {employee.department}
                </Text>
              </View>
              <View style={styles.nikPill}>
                <Text style={styles.nikPillText}>{employee.nik}</Text>
              </View>
            </View>
            <Pressable
              style={styles.roundBtn}
              onPress={() => navigation.navigate("ProfilePhoto")}
              hitSlop={6}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <RadialGlow size={240} color={c.glowHeader} top={-70} left={-30} />

          <View style={styles.identityRow}>
            <LinearGradient
              colors={[c.accent, c.accent2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{employee.avatarInitials}</Text>
            </LinearGradient>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name}>{employee.fullName}</Text>
              <Text style={styles.role}>
                {employee.jobTitle} · {employee.department}
              </Text>
              <Text style={styles.empId}>{employee.nik}</Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <View style={styles.statCard}>
          <Stat
            value={`${tahunSejak(employee.joinDate)} ${t("profil.th")}`}
            label={t("profil.masaKerja")}
          />
          <View style={styles.statDivider} />
          <Stat
            value={`${cuti?.remaining ?? "–"}`}
            label={t("profil.sisaCuti")}
            memuat={balances === null}
          />
          <View style={styles.statDivider} />
          <Stat
            value={employee.kpiScore.toFixed(1).replace(".", ",")}
            label={t("profil.skorKpi")}
          />
        </View>

        <View style={styles.menuCard}>
          <MenuRow
            iconBg={c.info.bg}
            ink={c.info.ink}
            icon={ICON.user}
            title={t("profil.dataPribadi")}
            subtitle={t("profil.dataPribadiSub")}
            onPress={() => navigation.navigate("ProfileData")}
          />
          <MenuRow
            iconBg={c.ok.bg}
            ink={c.ok.ink}
            icon={ICON.document}
            title={t("profil.dokumen")}
            subtitle={t("profil.dokumenSub")}
            onPress={() => navigation.navigate("ProfileDocs")}
          />
          <MenuRow
            iconBg={c.warn.bg}
            ink={c.warn.ink}
            icon={ICON.bell}
            title={t("profil.push")}
            subtitle={t("profil.pushSub")}
            trailing={
              <Switch
                value={pushOn}
                onValueChange={setPushOn}
                trackColor={{ false: c.track, true: c.accent }}
                thumbColor="#fff"
              />
            }
          />
          <MenuRow
            iconBg={c.info.bg}
            ink={c.info.ink}
            icon={ICON.shield}
            title={t("profil.modeGelap")}
            subtitle={
              mode === "dark"
                ? t("profil.modeGelapAktif")
                : t("profil.modeGelapIkuti")
            }
            trailing={
              <Switch
                value={mode === "dark"}
                onValueChange={toggle}
                trackColor={{ false: c.track, true: c.accent }}
                thumbColor="#fff"
              />
            }
          />
          <MenuRow
            iconBg={c.ok.bg}
            ink={c.ok.ink}
            icon={ICON.document}
            title={t("profil.bahasa")}
            subtitle={t("profil.bahasaSub")}
            trailing={<LanguagePicker />}
          />
          <MenuRow
            iconBg={c.purple.bg}
            ink={c.purple.ink}
            icon={ICON.shield}
            title={t("profil.keamanan")}
            subtitle={t("profil.keamananSub")}
            isLast
            onPress={() => navigation.navigate("ProfileSecurity")}
          />
        </View>

        <Pressable
          ref={keluarRef}
          style={styles.logout}
          onPress={async () => {
            const ya = await confirm({
              title: t("profil.keluarJudul"),
              message: t("profil.keluarPesan"),
              tone: "bad",
              confirmText: t("umum.keluar"),
              cancelText: t("umum.batal"),
              from: keluarRef,
              fromColor: c.bad.bg,
              fromTextColor: c.bad.ink,
              fromLabel: t("umum.keluar"),
              fromRadius: 22,
            });
            if (!ya) return;
            await hrisApi.logout().catch(() => {});
            setEmployee(null);
          }}
        >
          <Text style={styles.logoutText}>{t("umum.keluar")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Stat({
  value,
  label,
  memuat,
}: {
  value: string;
  label: string;
  memuat?: boolean;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.stat}>
      {memuat ? (
        <Skeleton width={34} height={17} radius={5} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({
  iconBg,
  ink,
  icon,
  title,
  subtitle,
  trailing,
  isLast,
  onPress,
}: {
  iconBg: string;
  ink: string;
  icon: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable
      style={[styles.menuRow, !isLast && styles.menuDivider]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <LineIcon d={icon} color={ink} size={16} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>

      {trailing ?? (
        <Ionicons name="chevron-forward" size={16} color={c.mutedLabel} />
      )}
    </Pressable>
  );
}
const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      backgroundColor: c.headerBg,
      paddingHorizontal: 20,
      paddingBottom: 44,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      overflow: "hidden",
    },
    photoHero: {
      backgroundColor: c.headerBg,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    photoInfo: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 46,
    },
    photoName: {
      fontSize: 26,
      lineHeight: 31,
      fontWeight: "800",
      letterSpacing: -0.5,
      color: "#fff",
    },
    photoMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
    nikPill: {
      alignSelf: "flex-start",
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: c.onDark.pill,
    },
    nikPillText: { fontSize: 10.5, fontWeight: "700", color: c.accentLight },
    roundBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.onDark.pill,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: {
      width: 66,
      height: 66,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 22, fontWeight: "800", color: "#fff" },
    name: { fontSize: 18, lineHeight: 22, fontWeight: "800", color: "#fff" },
    role: {
      fontSize: 12,
      fontWeight: "500",
      color: c.onDark.muted,
      marginTop: 4,
    },
    empId: {
      fontSize: 10.5,
      fontWeight: "600",
      color: c.accentLight,
      marginTop: 6,
    },

    body: { flex: 1, marginTop: -28 },
    content: { paddingHorizontal: 18, paddingBottom: 130 },

    statCard: {
      flexDirection: "row",
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 14,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    stat: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 17, fontWeight: "800", color: c.ink },
    statLabel: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },
    statDivider: { width: 1, backgroundColor: c.hair },

    menuCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      marginTop: 12,
      overflow: "hidden",
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 15,
      paddingVertical: 14,
    },
    menuDivider: { borderBottomWidth: 1, borderBottomColor: c.hair },
    menuIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    menuTitle: { fontSize: 13, fontWeight: "600", color: c.ink },
    menuSub: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 2,
    },

    logout: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 22,
      backgroundColor: c.bad.bg,
      alignItems: "center",
    },
    logoutText: { fontSize: 13, fontWeight: "700", color: c.bad.ink },
  });
