import { useMemo } from "react";
import { useProfilePhoto } from "@/hooks/useProfilePhoto";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Reveal, RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { RadialGlow } from "@/components/RadialGlow";
import { Palette, secondaryButtonStyle } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { useSession } from "@/services/session";
import { useTenant, type Fitur } from "@/services/tenant";
import { LinearGradient } from "expo-linear-gradient";
import { getShiftInfo, employeeGreeting } from "@/utils/greeting";
import { formatLongDate, formatJam } from "@/utils/date";
import { useT, getActiveLanguage } from "@/i18n";
import { EmploymentSlice } from "@/services/types";
import { ICON } from "@/constants/icons";
import { DonutChart } from "@/components/DonutChart";
import { Skeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { useHome } from "@/hooks/useHome";
import type { TranslationKey } from "@/i18n/id";

// Pengingat daftar ulang wajah muncul sekali per pembukaan aplikasi.

interface ItemMenu {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  ink: string;
  onPress: () => void;
}

type MenuSectionKey = "transaction" | "data" | "team";

// Urutan bagian menu di Beranda, mengikuti pengelompokan Transaksi / Data Karyawan.
const MENU_SECTIONS: { key: MenuSectionKey; title: TranslationKey }[] = [
  { key: "transaction", title: "hm.secTransaksi" },
  { key: "data", title: "hm.secData" },
  { key: "team", title: "hm.secTim" },
];

const MENU_SECTION_OF: Record<string, MenuSectionKey> = {
  attendance: "transaction",
  requestLeave: "transaction",
  requestOvertime: "transaction",
  trip: "transaction",
  wfh: "transaction",
  correction: "transaction",
  appraisal: "transaction",
  history: "data",
  leaveList: "data",
  overtimeList: "data",
  tax: "data",
  payslip: "data",
  approval: "team",
  employees: "team",
  teamAttendance: "team",
  offlineReview: "team",
  documentReview: "team",
  profileReview: "team",
  faceReview: "team",
};

// Menu fitur berbayar disembunyikan bila tidak termasuk paket langganan company.
const MENU_FITUR: Partial<Record<string, Fitur>> = {
  requestOvertime: "lembur",
  overtimeList: "lembur",
  trip: "dinas_wfh",
  wfh: "dinas_wfh",
  appraisal: "penilaian_kinerja",
  tax: "pajak_bpjs",
  documentReview: "dokumen",
};

export function HomeScreen() {
  const {
    now,
    navigation,
    notifications,
    clock,
    balances,
    history,
    employment,
    errorMessage,
    load,
  } = useHome();
  const t = useT();
  const { punyaFitur } = useTenant();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Dimuat ulang setiap Beranda mendapat fokus, supaya hasil persetujuan atau
  // pengajuan di tab lain langsung tampil saat kembali ke sini.
  // Jam, sapaan, dan status absen diperbarui selagi Beranda terbuka dan aplikasi di depan (berhenti di latar belakang).
  const profilePhoto = useProfilePhoto();
  if (!employee) return null;

  const greeting =
    employee.role === "mss"
      ? t("hm.sapaMss")
      : employee.role === "hr"
        ? t("hm.sapaHr")
        : employeeGreeting(clock, now);

  const greetingSub =
    employee.role === "mss"
      ? t("hm.timKamu", { dept: employee.department })
      : employee.role === "hr"
        ? employment
          ? t("hm.karyawanAktif", {
              n: employment.reduce((n, s) => n + s.count, 0),
            })
          : t("umum.memuat")
        : getShiftInfo(clock, clock?.workLocation ?? t("ab.kantor"));

  const feedTitle =
    employee.role === "mss"
      ? t("hm.perluSetuju")
      : employee.role === "hr"
        ? t("hm.perhatianHr")
        : t("hm.aktivitas");

  // Kelimanya datang dari satu Promise.all, tapi flag ini sengaja menyebut
  // semuanya: kalau suatu saat ada yang dipisah, cek ini tidak ikut bohong.
  const isLoading =
    clock === null ||
    notifications === null ||
    balances === null ||
    history === null;

  const attendanceHistory = history ?? [];
  const balanceList = balances ?? [];

  const clockInTime = clock?.lastCheckIn ?? "--:--";
  const clockOutTime = clock?.lastCheckOut ?? "--:--";
  const isAttendanceDone =
    !!clock && !clock.clockedIn && !!clock.lastCheckIn && !!clock.lastCheckOut;
  const clockCtaText = isAttendanceDone
    ? t("hm.absensiSelesai")
    : clock?.clockedIn
      ? t("hm.clockOut")
      : t("hm.clockInSekarang");

  const presentCount = attendanceHistory.filter(
    (r) => r.status !== "izin",
  ).length;
  const attendanceRate = attendanceHistory.length
    ? `${((presentCount / attendanceHistory.length) * 100).toFixed(1).replace(".", getActiveLanguage() === "en" ? "." : ",")}%`
    : "-";

  const leaveBalance = balanceList.find((b) => b.type === "cuti");
  const overtime = balanceList.find((b) => b.type === "lembur");
  const lateMinutes = attendanceHistory.filter(
    (r) => r.status === "telat",
  ).length;

  const canApprove = employee.role === "mss" || employee.role === "hr";

  // Atasan/HR membuka Inbox Approval; karyawan membuka daftar pengajuannya.
  const openFeed = (id: string) => {
    if (canApprove) navigation.navigate("Approval");
    else if (id.startsWith("OT-")) navigation.navigate("Overtime");
    else navigation.navigate("LeaveList");
  };

  // Seluruh menu milik akun ini. Tujuh pertama tampil di Beranda (dua baris, "Semua" di ujung kanan baris kedua);
  // "Semua" membuka lembar berisi semuanya.
  const makeMenuItem = (
    key: string,
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    tone: "info" | "ok" | "warn" | "bad" | "purple",
    onPress: () => void,
  ): ItemMenu => ({
    key,
    label,
    icon,
    // Ikon tanpa kotak latar (seperti tab bar): kuning dituakan supaya terbaca di atas latar terang.
    bg: "transparent",
    ink: tone === "warn" ? "#D97706" : c[tone].ink,
    onPress,
  });
  const submitRequest = (kind: "cuti" | "lembur" | "trip" | "wfh") => () =>
    navigation.navigate("LeaveRequest", { kind, n: Date.now() });
  // Tujuan yang sudah jadi tab di bar bawah tidak diulang di menu. Tab kedua
  // bergantung peran: Absensi (karyawan), Approval (mss), Absensi Kry (hr).
  const alreadyInTabs = new Set([
    "payslip",
    ...(employee.role === "mss" ? ["approval"] : []),
    ...(employee.role === "mss" || employee.role === "hr"
      ? []
      : ["attendance"]),
  ]);
  const allMenuItems: ItemMenu[] = [
    ...(canApprove
      ? [
          makeMenuItem(
            "approval",
            t("hm.aApproval"),
            "checkmark-done-outline",
            "warn",
            () => navigation.navigate("Approval"),
          ),
          makeMenuItem(
            "employees",
            t("hm.aKaryawan"),
            "people-outline",
            "purple",
            () => navigation.navigate("StaffList"),
          ),
        ]
      : []),
    makeMenuItem(
      "attendance",
      t("cr.presensi"),
      "finger-print-outline",
      "info",
      () => navigation.navigate("Clock"),
    ),
    makeMenuItem(
      "requestLeave",
      t("cr.cuti"),
      "calendar-outline",
      "info",
      submitRequest("cuti"),
    ),
    makeMenuItem(
      "requestOvertime",
      t("cr.lembur"),
      "moon-outline",
      "warn",
      submitRequest("lembur"),
    ),
    makeMenuItem(
      "trip",
      t("cr.dinas"),
      "briefcase-outline",
      "purple",
      submitRequest("trip"),
    ),
    makeMenuItem(
      "wfh",
      t("cr.wfh"),
      "laptop-outline",
      "ok",
      submitRequest("wfh"),
    ),
    makeMenuItem("payslip", t("hm.aSlip"), "wallet-outline", "ok", () =>
      navigation.navigate("PayslipList"),
    ),
    makeMenuItem(
      "appraisal",
      t("hm.aAppraisal"),
      "star-outline",
      "purple",
      () => navigation.navigate("Appraisal"),
    ),
    makeMenuItem("history", t("hm.aRiwayat"), "time-outline", "info", () =>
      navigation.navigate("History"),
    ),
    makeMenuItem("correction", t("hm.aKoreksi"), "create-outline", "warn", () =>
      navigation.navigate("AttendanceCorrection"),
    ),
    makeMenuItem(
      "leaveList",
      t("hm.aCuti"),
      "calendar-number-outline",
      "info",
      () => navigation.navigate("LeaveList"),
    ),
    makeMenuItem(
      "overtimeList",
      t("hm.aLembur"),
      "hourglass-outline",
      "warn",
      () => navigation.navigate("Overtime"),
    ),
    makeMenuItem("tax", t("hm.aPajak"), "receipt-outline", "info", () =>
      navigation.navigate("TaxDetail"),
    ),
    ...(canApprove
      ? [
          makeMenuItem(
            "offlineReview",
            t("hm.aOffline"),
            "cloud-offline-outline",
            "warn",
            () => navigation.navigate("OfflineReview"),
          ),
        ]
      : []),
    ...(employee.role === "mss"
      ? [
          makeMenuItem(
            "teamAttendance",
            t("hm.aAbsensiTim"),
            "people-circle-outline",
            "ok",
            () => navigation.navigate("StaffAttendance"),
          ),
        ]
      : []),
    ...(employee.role === "hr"
      ? [
          makeMenuItem(
            "documentReview",
            t("hm.aVerifikasi"),
            "document-text-outline",
            "info",
            () => navigation.navigate("DocumentReview"),
          ),
          makeMenuItem(
            "profileReview",
            t("pcr.aksi"),
            "person-circle-outline",
            "purple",
            () => navigation.navigate("ProfileChangeReview"),
          ),
          makeMenuItem("faceReview", t("hm.aWajah"), "scan-outline", "ok", () =>
            navigation.navigate("FaceReview"),
          ),
        ]
      : []),
  ].filter((m) => {
    const f = MENU_FITUR[m.key];
    return !alreadyInTabs.has(m.key) && (!f || punyaFitur(f));
  });
  const menuSections = MENU_SECTIONS.map((section) => ({
    ...section,
    items: allMenuItems.filter((m) => MENU_SECTION_OF[m.key] === section.key),
  })).filter((section) => section.items.length > 0);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <RadialGlow size={200} color={c.glowHeader} top={-60} right={-40} />

        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>{employee.avatarInitials}</Text>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{employee.fullName}</Text>
            <Text style={styles.role}>
              {employee.jobTitle} · {employee.department}
            </Text>
          </View>
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
              <Text style={styles.heroDate}>{formatLongDate()}</Text>
              <View style={styles.heroTimePill}>
                <Text style={styles.heroTimeText}>{formatJam()}</Text>
              </View>
            </View>
            {errorMessage && isLoading ? (
              <ErrorState message={errorMessage} onRetry={load} />
            ) : null}
            <View style={styles.clockRow}>
              <View style={styles.clockBox}>
                <Text style={styles.clockLabel}>{t("hm.clockIn")}</Text>
                {isLoading ? (
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
                {isLoading ? (
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
              style={[styles.heroCta, isAttendanceDone && styles.heroCtaDone]}
              onPress={() =>
                navigation.navigate(isAttendanceDone ? "History" : "Clock")
              }
            >
              {isAttendanceDone ? (
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
              ) : null}
              <Text
                style={[
                  styles.heroCtaText,
                  isAttendanceDone && styles.heroCtaTextDone,
                ]}
              >
                {clockCtaText}
              </Text>
            </Pressable>
          </LinearGradient>
        </View>

        <View style={styles.statGrid}>
          <StatCard
            iconBg={c.info.bg}
            ink={c.info.ink}
            icon="pie-chart-outline"
            label={t("hm.kehadiran")}
            value={attendanceRate}
            isLoading={isLoading}
          />
          <StatCard
            iconBg={c.ok.bg}
            ink={c.ok.ink}
            icon="calendar-outline"
            label={t("hm.sisaCuti")}
            value={
              leaveBalance
                ? `${leaveBalance.remaining} ${t(`unit.${leaveBalance.unit}`)}`
                : "–"
            }
            isLoading={isLoading}
          />
          <StatCard
            iconBg={c.warn.bg}
            ink={c.warn.ink}
            icon="moon-outline"
            label={t("hm.jamLembur")}
            value={
              overtime
                ? `${overtime.remaining} ${t(`unit.${overtime.unit}`)}`
                : "–"
            }
            isLoading={isLoading}
          />
          <StatCard
            iconBg={c.bad.bg}
            ink={c.bad.ink}
            icon="alarm-outline"
            label={t("hm.terlambat")}
            value={t("hm.kali", { n: lateMinutes })}
            isLoading={isLoading}
          />
        </View>
        {employment && <EmploymentCard slices={employment} />}
        {menuSections.map((section) => (
          <View key={section.key}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t(section.title)}</Text>
            </View>
            <View style={styles.quickGrid}>
              {section.items.map((q) => (
                <QuickAction
                  key={q.key}
                  iconBg={q.bg}
                  ink={q.ink}
                  icon={q.icon}
                  label={q.label}
                  onPress={q.onPress}
                />
              ))}
            </View>
          </View>
        ))}
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
          {isLoading
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
          {!isLoading && (notifications ?? []).length === 0 ? (
            <EmptyState
              height={230}
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
              onPress={() => openFeed(n.id)}
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
  ink,
  icon,
  label,
  value,
  isLoading,
}: {
  iconBg: string;
  ink: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLoading?: boolean;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    // Tiap kartu di grid naik satu per satu (lihat Reveal.tsx), jadi
    // ukurannya dipegang pembungkus Reveal.
    <Reveal style={styles.statCell}>
      <View style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: "transparent" }]}>
          <Ionicons name={icon} size={24} color={ink} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
        {isLoading ? (
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
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Reveal style={styles.quickCell}>
      <Pressable style={styles.quickCard} onPress={onPress}>
        <View style={styles.quickIcon}>
          <Ionicons name={icon} size={26} color={ink} />
        </View>
        <Text style={styles.quickLabel} numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    </Reveal>
  );
}

const SLICE_COLORS = ["accent2", "accent", "accentLight", "track"] as const;

function EmploymentCard({ slices }: { slices: EmploymentSlice[] }) {
  const t = useT();
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const toneColor = (i: number) => c[SLICE_COLORS[i % SLICE_COLORS.length]];

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
            color: toneColor(i),
          }))}
        >
          <Text style={styles.empHoleValue}>{total}</Text>
          <Text style={styles.empHoleLabel}>{t("hm.total")}</Text>
        </DonutChart>

        <View style={styles.empLegend}>
          {slices.map((s, i) => (
            <View key={s.label} style={styles.empRow}>
              <View
                style={[styles.empDot, { backgroundColor: toneColor(i) }]}
              />
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
      overflow: "hidden",
    },

    avatarImage: { width: "100%", height: "100%" },
    avatarText: { fontSize: 14, fontWeight: "700", color: c.info.ink },
    name: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
    role: {
      fontSize: 11.5,
      fontWeight: "500",
      color: c.onDark.muted,
      marginTop: 2,
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

    content: { padding: 18, paddingTop: 16, paddingBottom: 160 },
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

    heroCtaDone: {
      flexDirection: "row",
      gap: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    heroCtaTextDone: { color: "#FFFFFF" },
    quickGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
    quickCell: { width: "25%", alignItems: "center", marginBottom: 14 },
    quickCard: { alignItems: "center", gap: 7, width: "100%" },
    // Kotak putih berbingkai tipis + bayangan lembut, supaya tidak menyatu dengan latar halaman.
    quickIcon: {
      ...secondaryButtonStyle(c),
      width: 62,
      height: 62,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    quickLabel: {
      height: 28,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "600",
      color: c.ink,
      textAlign: "center",
      paddingHorizontal: 2,
    },
  });
