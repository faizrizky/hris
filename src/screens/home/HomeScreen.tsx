import React, { useCallback, useState, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Reveal, RevealScrollView as ScrollView } from "@/components/Reveal";
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { formatTanggalPanjang, formatJam } from "@/utils/date";
import { useT, bahasaAktif } from "@/i18n";
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
import { describeError } from "@/services/api/http";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";

export function HomeScreen() {
  const t = useT();
  const { employee } = useSession();
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<FeedItem[] | null>(null);
  const [clock, setClock] = useState<ClockState | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [employment, setEmployment] = useState<EmploymentSlice[] | null>(null);
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [galat, setGalat] = useState<string | null>(null);
  const [belumDibaca, setBelumDibaca] = useState(0);

  // Dimuat ulang setiap Beranda mendapat fokus, supaya hasil persetujuan atau
  // pengajuan di tab lain langsung tampil saat kembali ke sini.
  const muat = useCallback(() => {
    if (!employee) return;
    setGalat(null);
    Promise.all([
      hrisApi.getFeed(employee.id, employee.role),
      hrisApi.getClockState(employee.id),
      hrisApi.getLeaveBalances(employee.id),
      hrisApi.getAttendanceHistory(employee.id),
      hrisApi.getEmploymentSummary(employee.id),
    ])
      .then(([notif, clockState, leaveBalances, attendance, komposisi]) => {
        setNotifications(notif);
        setClock(clockState);
        setBalances(leaveBalances);
        setHistory(attendance);
        setEmployment(komposisi);
      })
      .catch((e) => setGalat(describeError(e)));
    // Titik merah di lonceng hanya bila masih ada notifikasi belum dibaca.
    // Dimuat terpisah supaya kegagalannya tidak menggagalkan Beranda.
    hrisApi
      .getNotificationInbox(employee.id)
      .then((n) => setBelumDibaca(n.filter((x) => !x.read).length))
      .catch(() => setBelumDibaca(0));
  }, [employee]);

  useFocusEffect(muat);

  if (!employee) return null;

  const greeting =
    employee.role === "mss"
      ? t("hm.sapaMss")
      : employee.role === "hr"
        ? t("hm.sapaHr")
        : t("hm.sapaEss");

  const greetingSub =
    employee.role === "mss"
      ? t("hm.timKamu", { dept: employee.department })
      : employee.role === "hr"
        ? employment
          ? t("hm.karyawanAktif", {
              n: employment.reduce((n, s) => n + s.count, 0),
            })
          : t("umum.memuat")
        : t("hm.shift");

  const feedTitle =
    employee.role === "mss"
      ? t("hm.perluSetuju")
      : employee.role === "hr"
        ? t("hm.perhatianHr")
        : t("hm.aktivitas");

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
  const clockCta = clock?.clockedIn
    ? t("hm.clockOut")
    : t("hm.clockInSekarang");

  const hadir = riwayat.filter((r) => r.status !== "izin").length;
  const kehadiran = riwayat.length
    ? `${((hadir / riwayat.length) * 100).toFixed(1).replace(".", bahasaAktif() === "en" ? "." : ",")}%`
    : "-";

  const cuti = saldo.find((b) => b.type === "cuti");
  const lembur = saldo.find((b) => b.type === "lembur");
  const telat = riwayat.filter((r) => r.status === "telat").length;

  const canApprove = employee.role === "mss" || employee.role === "hr";

  // Atasan/HR membuka Inbox Approval; karyawan membuka daftar pengajuannya.
  const bukaFeed = (id: string) => {
    if (canApprove) navigation.navigate("Approval");
    else if (id.startsWith("OT-")) navigation.navigate("Overtime");
    else navigation.navigate("LeaveList");
  };

  const quickActions = [
    ...(canApprove
      ? [
          {
            label: t("hm.aApproval"),
            icon: ICON.approval,
            bg: c.warn.bg,
            ink: c.warn.ink,
            onPress: () => navigation.navigate("Approval"),
          },
          {
            label: t("hm.aKaryawan"),
            icon: ICON.user,
            bg: c.purple.bg,
            ink: c.purple.ink,
            onPress: () => navigation.navigate("StaffList"),
          },
          {
            label: t("hm.aOffline"),
            icon: ICON.clock,
            bg: c.warn.bg,
            ink: c.warn.ink,
            onPress: () => navigation.navigate("OfflineReview"),
          },
          ...(employee.role === "hr"
            ? [
                {
                  label: t("hm.aVerifikasi"),
                  icon: ICON.document,
                  bg: c.info.bg,
                  ink: c.info.ink,
                  onPress: () => navigation.navigate("DocumentReview"),
                },
                {
                  label: t("pcr.aksi"),
                  icon: ICON.user,
                  bg: c.purple.bg,
                  ink: c.purple.ink,
                  onPress: () => navigation.navigate("ProfileChangeReview"),
                },
              ]
            : []),
        ]
      : []),
    ...(employee?.role === "mss"
      ? [
          {
            label: t("hm.aAbsensiTim"),
            icon: ICON.attendanceRate,
            bg: c.ok.bg,
            ink: c.ok.ink,
            onPress: () => navigation.navigate("StaffAttendance"),
          },
        ]
      : []),
    {
      label: t("hm.aPengumuman"),
      icon: ICON.bell,
      bg: c.warn.bg,
      ink: c.warn.ink,
      onPress: () => navigation.navigate("Announcements"),
    },
    {
      label: t("hm.aAbsensi"),
      icon: ICON.clock,
      bg: c.info.bg,
      ink: c.info.ink,
      onPress: () => navigation.navigate("Clock"),
    },
    {
      label: t("hm.aCuti"),
      icon: ICON.leave,
      bg: c.info.bg,
      ink: c.info.ink,
      onPress: () => navigation.navigate("LeaveList"),
    },
    {
      label: t("hm.aLembur"),
      icon: ICON.overtime,
      bg: c.warn.bg,
      ink: c.warn.ink,
      onPress: () => navigation.navigate("Overtime"),
    },
    {
      label: t("hm.aSlip"),
      icon: ICON.payslip,
      bg: c.ok.bg,
      ink: c.ok.ink,
      onPress: () => navigation.navigate("PayslipList"),
    },
    {
      label: t("hm.aAppraisal"),
      icon: ICON.appraisal,
      bg: c.purple.bg,
      ink: c.purple.ink,
      onPress: () => navigation.navigate("Appraisal"),
    },
    {
      label: t("hm.aPajak"),
      icon: ICON.tax,
      bg: c.info.bg,
      ink: c.info.ink,
      onPress: () => navigation.navigate("TaxDetail"),
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
              color={c.onDark.ink}
            />
            {belumDibaca > 0 && <View style={styles.notifDot} />}
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
            {galat && memuat ? (
              <ErrorState pesan={galat} onUlangi={muat} />
            ) : null}
            <View style={styles.clockRow}>
              <View style={styles.clockBox}>
                <Text style={styles.clockLabel}>{t("hm.clockIn")}</Text>
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
                <Text style={styles.clockLabel}>{t("hm.clockOut")}</Text>
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
              onPress={() => navigation.navigate("Clock")}
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
            label={t("hm.kehadiran")}
            value={kehadiran}
            memuat={memuat}
          />
          <StatCard
            iconBg={c.ok.bg}
            ink={c.ok.ink}
            icon={ICON.leave}
            label={t("hm.sisaCuti")}
            value={cuti ? `${cuti.remaining} ${t(`unit.${cuti.unit}`)}` : "–"}
            memuat={memuat}
          />
          <StatCard
            iconBg={c.warn.bg}
            ink={c.warn.ink}
            icon={ICON.overtime}
            label={t("hm.jamLembur")}
            value={
              lembur ? `${lembur.remaining} ${t(`unit.${lembur.unit}`)}` : "–"
            }
            memuat={memuat}
          />
          <StatCard
            iconBg={c.bad.bg}
            ink={c.bad.ink}
            icon={ICON.late}
            label={t("hm.terlambat")}
            value={t("hm.kali", { n: telat })}
            memuat={memuat}
          />
        </View>
        {employment && <EmploymentCard slices={employment} />}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("hm.aksiCepat")}</Text>
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
          <Pressable
            onPress={() =>
              navigation.navigate(
                employee.role === "ess" ? "LeaveList" : "Approval",
              )
            }
          >
            <Text style={styles.sectionLink}>{t("hm.lihatSemua")}</Text>
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
          {!memuat && (notifications ?? []).length === 0 ? (
            <EmptyState
              tinggi={230}
              icon={employee.role === "ess" ? ICON.leave : ICON.approval}
              title={
                employee.role === "ess" ? t("hm.kosongEss") : t("hm.kosongMgr")
              }
              text={
                employee.role === "ess"
                  ? t("hm.kosongEssIsi")
                  : t("hm.kosongMgrIsi")
              }
            />
          ) : null}
          {(notifications ?? []).map((n, i) => (
            <Pressable
              key={n.id}
              onPress={() => bukaFeed(n.id)}
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
            </Pressable>
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
    // Tiap kartu di grid naik satu per satu (lihat Reveal.tsx), jadi
    // ukurannya dipegang pembungkus Reveal.
    <Reveal style={styles.statCell}>
      <View style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
          <LineIcon d={icon} color={ink} size={16} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
        {memuat ? (
          <Skeleton
            width={76}
            height={17}
            radius={5}
            style={{ marginTop: 7 }}
          />
        ) : (
          <Text style={styles.statValue}>{value}</Text>
        )}
      </View>
    </Reveal>
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
    <Reveal style={styles.quickCell}>
      <Pressable style={styles.quickCard} onPress={onPress}>
        <View style={[styles.quickIcon, { backgroundColor: iconBg }]}>
          <LineIcon d={icon} color={ink} size={17} />
        </View>
        <Text style={styles.quickLabel}>{label}</Text>
      </Pressable>
    </Reveal>
  );
}

const SLICE_WARNA = ["accent2", "accent", "accentLight", "track"] as const;

function EmploymentCard({ slices }: { slices: EmploymentSlice[] }) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const warna = (i: number) => c[SLICE_WARNA[i % SLICE_WARNA.length]];

  return (
    <Card style={styles.empCard}>
      <View style={styles.empHead}>
        <Text style={styles.empTitle}>{t("hm.empStatus")}</Text>
        <Text style={styles.empTotal}>{t("hm.nKaryawan", { n: total })}</Text>
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
          <Text style={styles.empHoleLabel}>{t("hm.total")}</Text>
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
      color: c.onDark.muted,
      marginTop: 2,
    },
    notifButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.onDark.surface,
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
      color: c.onDark.faint,
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
      backgroundColor: c.onDark.surface,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroDate: {
      fontSize: 12.5,
      fontWeight: "600",
      color: c.onDark.ink,
    },
    heroTimePill: {
      backgroundColor: c.onDark.pill,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    heroTimeText: { fontSize: 11, fontWeight: "600", color: "#fff" },
    clockRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    clockBox: {
      flex: 1,
      backgroundColor: c.onDark.track,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    clockLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: c.onDark.ink,
    },
    clockValue: {
      fontSize: 19,
      lineHeight: 21,
      fontWeight: "800",
      color: "#fff",
      marginTop: 5,
    },
    clockValueMuted: { color: c.onDark.soft },
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
    statCell: { flexBasis: "48%", flexGrow: 1 },
    statCard: {
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
    quickCell: { width: "22.5%" },
    quickCard: {
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
