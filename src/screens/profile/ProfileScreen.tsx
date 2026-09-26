import React, { useEffect, useState } from "react";
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
import { colors } from "@/theme/colors";
import { tahunSejak } from "@/utils/date";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveBalance } from "@/services/types";

export function ProfileScreen() {
  const { employee, setEmployee } = useSession();
  const insets = useSafeAreaInsets();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    if (!employee) return;
    hrisApi.getLeaveBalances(employee.id).then(setBalances);
  }, [employee]);

  if (!employee) return null;

  const cuti = balances.find((b) => b.type === "cuti");

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <RadialGlow size={240} color={colors.glowHeader} top={-70} left={-30} />

        <View style={styles.identityRow}>
          <LinearGradient
            colors={[colors.accent, colors.accent2]}
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
            iconBg={colors.info.bg}
            ink={colors.info.ink}
            icon={ICON.user}
            title="Data pribadi & keluarga"
            subtitle="NIK, alamat, kontak darurat"
          />
          <MenuRow
            iconBg={colors.ok.bg}
            ink={colors.ok.ink}
            icon={ICON.document}
            title="Dokumen digital"
            subtitle="Kontrak, sertifikat, SK"
          />
          <MenuRow
            iconBg={colors.warn.bg}
            ink={colors.warn.ink}
            icon={ICON.bell}
            title="Notifikasi push"
            subtitle="Approval, payroll, pengumuman"
            trailing={
              <Switch
                value={pushOn}
                onValueChange={setPushOn}
                trackColor={{ false: colors.track, true: colors.accent }}
                thumbColor="#fff"
              />
            }
          />
          <MenuRow
            iconBg={colors.purple.bg}
            ink={colors.purple.ink}
            icon={ICON.shield}
            title="Keamanan & Face ID"
            subtitle="Biometrik, ubah password"
            isLast
          />
        </View>

        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Status sinkronisasi</Text>

          <View style={styles.syncRow}>
            <View style={[styles.dot, { backgroundColor: colors.ok.ink }]} />
            <Text style={styles.syncText}>Tersinkron dengan ERPNext</Text>
            <Text style={styles.syncTime}>14 Sep 08:41</Text>
          </View>

          <View style={[styles.syncRow, { marginTop: 9 }]}>
            <View style={[styles.dot, { backgroundColor: "#D97706" }]} />
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
}: {
  iconBg: string;
  ink: string;
  icon: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.menuRow, !isLast && styles.menuDivider]}>
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <LineIcon d={icon} color={ink} size={16} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>

      {trailing ?? (
        <Ionicons name="chevron-forward" size={16} color={colors.mutedLabel} />
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.ink,
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
    color: colors.accentLight,
    marginTop: 6,
  },

  body: { flex: 1, marginTop: -28 },
  content: { paddingHorizontal: 18, paddingBottom: 130 },

  statCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 22,
    padding: 14,
    shadowColor: "#0F1720",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 17, fontWeight: "800", color: colors.ink },
  statLabel: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 4,
  },
  statDivider: { width: 1, backgroundColor: colors.hair },

  menuCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  menuDivider: { borderBottomWidth: 1, borderBottomColor: colors.hair },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { fontSize: 13, fontWeight: "600", color: colors.ink },
  menuSub: {
    fontSize: 10.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 2,
  },

  syncCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 22,
    marginTop: 12,
    padding: 15,
  },
  syncTitle: { fontSize: 12.5, fontWeight: "700", color: colors.ink },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 11,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  syncText: { flex: 1, fontSize: 11.5, fontWeight: "500", color: colors.muted },
  syncTime: { fontSize: 10, fontWeight: "500", color: colors.mutedLabel },
  syncAction: { fontSize: 10, fontWeight: "600", color: colors.accent },

  logout: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: colors.bad.bg,
    alignItems: "center",
  },
  logoutText: { fontSize: 13, fontWeight: "700", color: colors.bad.ink },
});
