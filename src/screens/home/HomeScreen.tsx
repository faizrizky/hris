import React, { ReactNode, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { RadialGlow } from "@/components/RadialGlow";
import { colors } from "@/theme/colors";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { formatTanggalPanjang, formatJam } from "@/utils/date";
import {
  NotificationItem,
  ClockState,
  LeaveBalance,
  AttendanceRecord,
} from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";

export function HomeScreen() {
  const { employee } = useSession();
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [clock, setClock] = useState<ClockState | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!employee) return;
    Promise.all([
      hrisApi.getNotifications(employee.id),
      hrisApi.getClockState(employee.id),
      hrisApi.getLeaveBalances(employee.id),
      hrisApi.getAttendanceHistory(employee.id),
    ]).then(([notif, clockState, leaveBalances, attendance]) => {
      setNotifications(notif);
      setClock(clockState);
      setBalances(leaveBalances);
      setHistory(attendance);
    });
  }, [employee]);

  if (!employee) return null;

  const greeting =
    employee.role === "mss"
      ? "Selamat pagi, ada approval menunggu"
      : employee.role === "hr"
        ? "Payroll September menunggu review"
        : "Selamat pagi, jangan lupa clock in";

  const greetingSub =
    employee.role === "mss"
      ? `${employee.department} · tim kamu`
      : employee.role === "hr"
        ? "128 karyawan aktif · 7 belum absen hari ini"
        : "Shift reguler 08.00 – 17.00 · Kantor Pusat";

  const feedTitle =
    employee.role === "mss"
      ? "Perlu persetujuan"
      : employee.role === "hr"
        ? "Perhatian HR"
        : "Aktivitas terbaru";

  const clockInTime = clock?.lastCheckIn ?? "--:--";
  const clockOutTime = clock?.lastCheckOut ?? "--:--";
  const clockCta = clock?.clockedIn ? "Clock Out" : "Clock In Sekarang";

  const hadir = history.filter((r) => r.status !== "izin").length;
  const kehadiran = history.length
    ? `${((hadir / history.length) * 100).toFixed(1).replace(".", ",")}%`
    : "-";

  const cuti = balances.find((b) => b.type === "cuti");
  const lembur = balances.find((b) => b.type === "lembur");
  const telat = history.filter((r) => r.status === "telat").length;

  const canApprove = employee.role === "mss" || employee.role === "hr";

  const quikcActions = [
    ...(canApprove
      ? [
          {
            label: "Approval",
            icon: ICON.approval,
            bg: colors.warn.bg,
            ink: colors.warn.ink,
            onPress: () => navigation.navigate("Approval"),
          },
        ]
      : []),
    {
      label: "Absensi",
      icon: ICON.clock,
      bg: colors.info.bg,
      ink: colors.info.ink,
      onPress: () => navigation.navigate("Absensi"),
    },
    {
      label: "Cuti",
      icon: ICON.leave,
      bg: colors.info.bg,
      ink: colors.info.ink,
      onPress: () => navigation.navigate("Cuti"),
    },
    {
      label: "Lembur",
      icon: ICON.overtime,
      bg: colors.warn.bg,
      ink: colors.warn.ink,
      onPress: () => navigation.navigate("Cuti"),
    },
    {
      label: "Slip gaji",
      icon: ICON.payslip,
      bg: colors.ok.bg,
      ink: colors.ok.ink,
      onPress: () => navigation.navigate("Slip Gaji"),
    },
    {
      label: "Appraisal",
      icon: ICON.appraisal,
      bg: colors.purple.bg,
      ink: colors.purple.ink,
    },
    {
      label: "PPh21 & BPJS",
      icon: ICON.tax,
      bg: colors.info.bg,
      ink: colors.info.ink,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <RadialGlow
          size={200}
          color={colors.glowHeader}
          top={-60}
          right={-40}
        />

        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{employee.avatarInitials}</Text>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{employee.fullName}</Text>
            <Text style={styles.role}>
              {employee.jobTitle} · {employee.department}
            </Text>
          </View>
          <Pressable style={styles.notifButton}>
            <Ionicons
              name="notifications-outline"
              size={18}
              color="rgba(255,255,255,0.8)"
            />
            <View style={styles.notifDot} />
          </Pressable>
        </View>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.greetingSub}>{greetingSub}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroShadow}>
          <LinearGradient
            colors={[colors.accent, colors.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBlob} />

            <View style={styles.heroTopRow}>
              <Text style={styles.heroDate}>{formatTanggalPanjang()}</Text>
              <View style={styles.heroTimePill}>
                <Text style={styles.heroTimeText}>{formatJam()}</Text>
              </View>
            </View>

            <View style={styles.clockRow}>
              <View style={styles.clockBox}>
                <Text style={styles.clockLabel}>Clock In</Text>
                <Text style={styles.clockValue}>{clockInTime}</Text>
              </View>
              <View style={styles.clockBox}>
                <Text style={styles.clockLabel}>Clock Out</Text>
                <Text style={[styles.clockValue, styles.clockValueMuted]}>
                  {clockOutTime}
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.heroCta}
              onPress={() => navigation.navigate("Absensi")}
            >
              <Text style={styles.heroCtaText}>{clockCta}</Text>
            </Pressable>
          </LinearGradient>
        </View>

        <View style={styles.statGrid}>
          <StatCard
            iconBg={colors.info.bg}
            ink={colors.info.ink}
            icon={ICON.attendanceRate}
            label="Kehadiran bulan ini"
            value={kehadiran}
          />
          <StatCard
            iconBg={colors.ok.bg}
            ink={colors.ok.ink}
            icon={ICON.leave}
            label="Sisa cuti tahunan"
            value={cuti ? `${cuti.remaining} ${cuti.unit}` : "–"}
          />
          <StatCard
            iconBg={colors.warn.bg}
            ink={colors.warn.ink}
            icon={ICON.overtime}
            label="Jam lembur"
            value={lembur ? `${lembur.remaining} ${lembur.unit}` : "–"}
          />
          <StatCard
            iconBg={colors.bad.bg}
            ink={colors.bad.ink}
            icon={ICON.late}
            label="Terlambat"
            value={`${telat} kali`}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Aksi Cepat</Text>
        </View>

        <View style={styles.quickGrid}>
          {quikcActions.map((q) => (
            <QuickAction
              key={q.label}
              iconBg={q.bg}
              ink={q.ink}
              icon={q.icon}
              label={q.label}
              onPress={q.onPress}
            />
          ))}
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{feedTitle}</Text>
          <Pressable>
            <Text style={styles.sectionLink}>Lihat semua</Text>
          </Pressable>
        </View>

        <Card style={styles.feedCard}>
          {notifications.map((n, i) => (
            <View
              key={n.id}
              style={[
                styles.feedRow,
                i < notifications.length - 1 && styles.feedRowDivider,
              ]}
            >
              <View style={styles.feedAvatar}>
                <Text style={styles.feedAvatarText}>{n.initials}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.feedTitle}>{n.title}</Text>
                <Text style={styles.feedSub}>{n.subtitle}</Text>
              </View>

              <StatusBadge label={n.badge} tone={n.tone} variant="compact" />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function StatCard({
  iconBg,
  ink,
  icon,
  label,
  value,
}: {
  iconBg: string;
  ink: string;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <LineIcon d={icon} color={ink} size={16} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function QuickAction({
  iconBg,
  ink,
  icon,
  label,
  onPress,
}: {
  iconBg: string;
  ink: string;
  icon: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: iconBg }]}>
        <LineIcon d={icon} color={ink} size={17} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.ink,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.info.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: { fontSize: 14, fontWeight: "700", color: colors.info.ink },
  name: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
  role: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  notifButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#F97316",
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  greeting: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: "#fff",
    marginTop: 16,
  },
  greetingSub: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
  },

  content: { padding: 18, paddingTop: 16, paddingBottom: 120 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
    marginHorizontal: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  sectionLink: { fontSize: 11.5, fontWeight: "600", color: colors.accent },

  feedCard: { padding: 0, overflow: "hidden", marginBottom: 0 },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  feedRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hair },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.info.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  feedAvatarText: { fontSize: 12, fontWeight: "700", color: colors.info.ink },
  feedTitle: { fontSize: 13, fontWeight: "600", color: colors.ink },
  feedSub: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 3,
  },

  heroShadow: {
    borderRadius: 22,
    shadowColor: colors.accent2,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 6,
  },
  heroCard: { borderRadius: 22, padding: 18, overflow: "hidden" },
  heroBlob: {
    position: "absolute",
    right: -30,
    bottom: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroDate: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  heroTimePill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroTimeText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  clockRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  clockBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  clockLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },
  clockValue: {
    fontSize: 19,
    lineHeight: 21,
    fontWeight: "800",
    color: "#fff",
    marginTop: 5,
  },
  clockValueMuted: { color: "rgba(255,255,255,0.75)" },
  heroCta: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  heroCtaText: { fontSize: 13.5, fontWeight: "700", color: colors.accent2 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  statCard: {
    flexBasis: "48%",
    flexGrow: 1,
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
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 10,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.ink,
    marginTop: 4,
  },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  quickCard: {
    width: "22.5%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 8,
  },
  quickLabel: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
});
