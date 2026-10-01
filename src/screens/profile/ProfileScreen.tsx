import React, { useEffect, useState, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RadialGlow } from "@/components/RadialGlow";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { Palette } from "@/theme/colors";
import { useTheme, useThemeMode } from "@/theme/ThemeContext";
import { tahunSejak } from "@/utils/date";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveBalance } from "@/services/types";

export function ProfileScreen({ navigation }: any) {
  const { employee, setEmployee } = useSession();
  const insets = useSafeAreaInsets();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [pushOn, setPushOn] = useState(true);
  const { mode, toggle } = useThemeMode();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getLeaveBalances(employee.id).then(setBalances);
  }, [employee]);

  if (!employee) return null;

  const cuti = balances.find((b) => b.type === "cuti");

  return (
    <View style={styles.container}>
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

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <View style={styles.statCard}>
          <Stat
            value={`${tahunSejak(employee.joinDate)} th`}
            label="Masa kerja"
          />
          <View style={styles.statDivider} />
          <Stat value={`${cuti?.remaining ?? "–"}`} label="Sisa cuti" />
          <View style={styles.statDivider} />
          <Stat
            value={employee.kpiScore.toFixed(1).replace(".", ",")}
            label="Skor KPI"
          />
        </View>

        <View style={styles.menuCard}>
          <MenuRow
            iconBg={c.info.bg}
            ink={c.info.ink}
            icon={ICON.user}
            title="Data pribadi & keluarga"
            subtitle="NIK, alamat, kontak darurat"
            onPress={() => navigation.navigate("ProfileData")}
          />
          <MenuRow
            iconBg={c.ok.bg}
            ink={c.ok.ink}
            icon={ICON.document}
            title="Dokumen digital"
            subtitle="Kontrak, sertifikat, SK"
          />
          <MenuRow
            iconBg={c.warn.bg}
            ink={c.warn.ink}
            icon={ICON.bell}
            title="Notifikasi push"
            subtitle="Approval, payroll, pengumuman"
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
            title="Mode gelap"
            subtitle={mode === "dark" ? "Aktif" : "Mengikuti pilihanmu"}
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
            iconBg={c.purple.bg}
            ink={c.purple.ink}
            icon={ICON.shield}
            title="Keamanan & Face ID"
            subtitle="Biometrik, ubah password"
            isLast
          />
        </View>

        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Status sinkronisasi</Text>

          <View style={styles.syncRow}>
            <View style={[styles.dot, { backgroundColor: c.ok.ink }]} />
            <Text style={styles.syncText}>Tersinkron dengan ERPNext</Text>
            <Text style={styles.syncTime}>14 Sep 08:41</Text>
          </View>

          <View style={[styles.syncRow, { marginTop: 9 }]}>
            <View style={[styles.dot, { backgroundColor: c.warn.ink }]} />
            <Text style={styles.syncText}>2 data offline menunggu kirim</Text>
            <Text style={styles.syncAction}>Kirim</Text>
          </View>
        </View>

        <Pressable style={styles.logout} onPress={() => setEmployee(null)}>
          <Text style={styles.logoutText}>Keluar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
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
      color: "rgba(255,255,255,0.6)",
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

    syncCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      marginTop: 12,
      padding: 15,
    },
    syncTitle: { fontSize: 12.5, fontWeight: "700", color: c.ink },
    syncRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 11,
    },
    dot: { width: 9, height: 9, borderRadius: 4.5 },
    syncText: {
      flex: 1,
      fontSize: 11.5,
      fontWeight: "500",
      color: c.muted,
    },
    syncTime: { fontSize: 10, fontWeight: "500", color: c.mutedLabel },
    syncAction: { fontSize: 10, fontWeight: "600", color: c.accent },

    logout: {
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 22,
      backgroundColor: c.bad.bg,
      alignItems: "center",
    },
    logoutText: { fontSize: 13, fontWeight: "700", color: c.bad.ink },
  });
