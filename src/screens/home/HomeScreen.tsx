import React, { useEffect, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { RadialGlow } from "@/components/RadialGlow";
import { Palette } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { formatTanggalPanjang, formatJam } from "@/utils/date";
import {
  FeedItem,
  ClockState,
  LeaveBalance,
  AttendanceRecord,
  EmploymentSlice,
} from "@/services/types";
import { LineIcon } from "@/components/LineIcon";
import { ICON } from "@/constants/icons";
import { DonutChart } from "@/components/DonutChart";
import { Skeleton } from "@/components/Skeleton";

export function HomeScreen() {
  const { employee } = useSession();
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<FeedItem[] | null>(
    null,
  );
  const [clock, setClock] = useState<ClockState | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [employment, setEmployment] = useState<EmploymentSlice[] | null>(null);
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    Promise.all([
      hrisApi.getFeed(employee.id),
      hrisApi.getClockState(employee.id),
      hrisApi.getLeaveBalances(employee.id),
      hrisApi.getAttendanceHistory(employee.id),
      hrisApi.getEmploymentSummary(employee.id),
    ]).then(([notif, clockState, leaveBalances, attendance, komposisi]) => {
      setNotifications(notif);
      setClock(clockState);
      setBalances(leaveBalances);
      setHistory(attendance);
      setEmployment(komposisi);
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

  // Kelimanya datang dari satu Promise.all, tapi flag ini sengaja menyebut
  // semuanya: kalau suatu saat ada yang dipisah, cek ini tidak ikut bohong.
  const memuat =
    clock === null ||
    notifications === null ||
    balances === null ||
    history === null;

  const riwayat = history ?? [];
  const saldo = balances ?? [];

  const clockInTime = clock?.lastCheckIn ?? "--:--";
  const clockOutTime = clock?.lastCheckOut ?? "--:--";
  const clockCta = clock?.clockedIn ? "Clock Out" : "Clock In Sekarang";

  const hadir = riwayat.filter((r) => r.status !== "izin").length;
  const kehadiran = riwayat.length
    ? `${((hadir / riwayat.length) * 100).toFixed(1).replace(".", ",")}%`
    : "-";

  const cuti = saldo.find((b) => b.type === "cuti");
  const lembur = saldo.find((b) => b.type === "lembur");
  const telat = riwayat.filter((r) => r.status === "telat").length;

  const canApprove = employee.role === "mss" || employee.role === "hr";

  const quickActions = [
    ...(canApprove
      ? [
          {
            label: "Approval",
            icon: ICON.approval,
            bg: c.warn.bg,
            ink: c.warn.ink,
            onPress: () => navigation.navigate("Approval"),
          },
          {
            label: "Karyawan",
            icon: ICON.user,
            bg: c.purple.bg,
            ink: c.purple.ink,
            onPress: () => navigation.navigate("StaffList"),
          },
        ]
      : []),
    ...(employee?.role === "mss"
      ? [
          {
            label: "Absensi Tim",
            icon: ICON.attendanceRate,
            bg: c.ok.bg,
            ink: c.ok.ink,
            onPress: () => navigation.navigate("StaffAttendance"),
          },
        ]
      : []),
    {
      label: "Absensi",
      icon: ICON.clock,
      bg: c.info.bg,
      ink: c.info.ink,
      onPress: () => navigation.navigate("Absensi"),
    },
    {
      label: "Cuti",
      icon: ICON.leave,
      bg: c.info.bg,
      ink: c.info.ink,
      onPress: () => navigation.navigate("Cuti"),
    },
    {
      label: "Lembur",
      icon: ICON.overtime,
      bg: c.warn.bg,
      ink: c.warn.ink,
      onPress: () => navigation.navigate("Cuti", { screen: "Overtime" }),
    },
    {
      label: "Slip gaji",
      icon: ICON.payslip,
      bg: c.ok.bg,
      ink: c.ok.ink,
      onPress: () => navigation.navigate("Slip Gaji"),
    },
    {
      label: "Appraisal",
      icon: ICON.appraisal,
      bg: c.purple.bg,
      ink: c.purple.ink,
      onPress: () => navigation.navigate("Appraisal"),
    },
    {
      label: "PPh21 & BPJS",
      icon: ICON.tax,
      bg: c.info.bg,
      ink: c.info.ink,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <RadialGlow size={200} color={c.glowHeader} top={-60} right={-40} />

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
          <Pressable
            style={styles.notifButton}
            onPress={() => navigation.navigate("Notifications")}
          >
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
            colors={[c.accent, c.accent2]}
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
                {memuat ? (
                  <Skeleton
                    width={72}
                    height={19}
                    radius={6}
                    color={c.onDark.pill}
                    style={{ marginTop: 6 }}
                  />
                ) : (
                  <Text style={styles.clockValue}>{clockInTime}</Text>
                )}
              </View>
              <View style={styles.clockBox}>
                <Text style={styles.clockLabel}>Clock Out</Text>
                {memuat ? (
                  <Skeleton
                    width={72}
                    height={19}
                    radius={6}
                    color={c.onDark.pill}
                    style={{ marginTop: 6 }}
                  />
                ) : (
                  <Text style={[styles.clockValue, styles.clockValueMuted]}>
                    {clockOutTime}
                  </Text>
                )}
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
            iconBg={c.info.bg}
            ink={c.info.ink}
            icon={ICON.attendanceRate}
            label="Kehadiran bulan ini"
            value={kehadiran}
          memuat={memuat}
            />
          <StatCard
            iconBg={c.ok.bg}
            ink={c.ok.ink}
            icon={ICON.leave}
            label="Sisa cuti tahunan"
            value={cuti ? `${cuti.remaining} ${cuti.unit}` : "–"}
          memuat={memuat}
            />
          <StatCard
            iconBg={c.warn.bg}
            ink={c.warn.ink}
            icon={ICON.overtime}
            label="Jam lembur"
            value={lembur ? `${lembur.remaining} ${lembur.unit}` : "–"}
          memuat={memuat}
            />
          <StatCard
            iconBg={c.bad.bg}
            ink={c.bad.ink}
            icon={ICON.late}
            label="Terlambat"
            value={`${telat} kali`}
          memuat={memuat}
            />
        </View>
        {employment && <EmploymentCard slices={employment} />}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Aksi Cepat</Text>
        </View>

        <View style={styles.quickGrid}>
          {quickActions.map((q) => (
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
          {memuat
            ? [0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[styles.feedRow, i < 2 && styles.feedRowDivider]}
                >
                  <Skeleton width={36} height={36} radius={12} />
                  <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                    <Skeleton width="68%" height={12} radius={4} />
                    <Skeleton width="88%" height={10} radius={4} />
                  </View>
                  <Skeleton width={56} height={20} radius={8} />
                </View>
              ))
            : null}
          {(notifications ?? []).map((n, i) => (
            <View
              key={n.id}
              style={[
                styles.feedRow,
                i < (notifications?.length ?? 0) - 1 && styles.feedRowDivider,
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
  memuat,
}: {
  iconBg: string;
  ink: string;
  icon: string;
  label: string;
  value: string;
  memuat?: boolean;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <LineIcon d={icon} color={ink} size={16} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      {memuat ? (
        <Skeleton width={76} height={17} radius={5} style={{ marginTop: 7 }} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
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
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: iconBg }]}>
        <LineIcon d={icon} color={ink} size={17} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const SLICE_WARNA = ["accent2", "accent", "accentLight", "track"] as const;

function EmploymentCard({ slices }: { slices: EmploymentSlice[] }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const warna = (i: number) => c[SLICE_WARNA[i % SLICE_WARNA.length]];

  return (
    <Card style={styles.empCard}>
      <View style={styles.empHead}>
        <Text style={styles.empTitle}>Employment Status</Text>
        <Text style={styles.empTotal}>{total} karyawan</Text>
      </View>

      <View style={styles.empBody}>
        <DonutChart
          size={112}
          stroke={19}
          segments={slices.map((s, i) => ({
            value: s.count,
            color: warna(i),
          }))}
        >
          <Text style={styles.empHoleValue}>{total}</Text>
          <Text style={styles.empHoleLabel}>Total</Text>
        </DonutChart>

        <View style={styles.empLegend}>
          {slices.map((s, i) => (
            <View key={s.label} style={styles.empRow}>
              <View style={[styles.empDot, { backgroundColor: warna(i) }]} />
              <Text style={styles.empLabel}>
                {s.label} ({Math.round((s.count / total) * 100)}%)
              </Text>
              <Text style={styles.empCount}>{s.count}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      backgroundColor: c.headerBg,
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
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },

    avatarText: { fontSize: 14, fontWeight: "700", color: c.info.ink },
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
      borderColor: c.headerBg,
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
    empCard: { marginTop: 12 },
    empHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    empTitle: { fontSize: 14, fontWeight: "700", color: c.ink },
    empTotal: { fontSize: 11, fontWeight: "500", color: c.muted },

    empBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: 18,
      marginTop: 16,
    },
    empHoleValue: { fontSize: 21, fontWeight: "800", color: c.ink },
    empHoleLabel: {
      fontSize: 9.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    empLegend: { flex: 1, gap: 9 },
    empRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    empDot: { width: 9, height: 9, borderRadius: 3 },
    empLabel: { flex: 1, fontSize: 12, fontWeight: "500", color: c.ink },
    empCount: { fontSize: 12, fontWeight: "700", color: c.muted },

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 20,
      marginBottom: 10,
      marginHorizontal: 2,
    },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: c.ink },
    sectionLink: { fontSize: 11.5, fontWeight: "600", color: c.accent },

    feedCard: { padding: 0, overflow: "hidden", marginBottom: 0 },
    feedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 15,
    },
    feedRowDivider: { borderBottomWidth: 1, borderBottomColor: c.hair },
    feedAvatar: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.info.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    feedAvatarText: { fontSize: 12, fontWeight: "700", color: c.info.ink },
    feedTitle: { fontSize: 13, fontWeight: "600", color: c.ink },
    feedSub: {
      fontSize: 11,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },

    heroShadow: {
      borderRadius: 22,
      shadowColor: c.accent2,
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
    heroCtaText: { fontSize: 13.5, fontWeight: "700", color: c.accent2 },

    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 12,
    },
    statCard: {
      flexBasis: "48%",
      flexGrow: 1,
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
      color: c.muted,
      marginTop: 10,
    },
    statValue: {
      fontSize: 24,
      lineHeight: 26,
      fontWeight: "800",
      letterSpacing: -0.5,
      color: c.ink,
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
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
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
      color: c.ink,
      textAlign: "center",
    },
  });
