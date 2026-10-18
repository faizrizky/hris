import { useEffect, useState, useMemo } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { RevealScrollView as ScrollView } from "@/components/Reveal";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Palette,
  secondaryButtonStyle,
  primaryButtonStyle,
} from "@/theme/colors";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { ErrorState } from "@/components/ErrorState";
import { useSession } from "@/services/session";
import { AttendanceRecord, Staff } from "@/services/types";
import { RadialGlow } from "@/components/RadialGlow";
import { Skeleton } from "@/components/Skeleton";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
} from "@/constants/statusLabels";
import { formatDecimal } from "@/utils/currency";
import {
  getShortMonth,
  formatNumericDate,
  formatShortDateWithYear,
} from "@/utils/date";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/kembali";

export function StaffDetailScreen({ navigation, route }: ScreenProps) {
  const t = useT();
  const { employee } = useSession();
  const insets = useSafeAreaInsets();
  const { staffId } = getRouteParams<{ staffId: string }>(route);

  const [staff, setStaff] = useState<Staff | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // naik saat Coba lagi ditekan
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!employee) return;
    let isCancelled = false;

    Promise.all([
      hrisApi.getStaffDirectory(employee.id),
      hrisApi.getStaffAttendanceHistory(staffId),
    ])
      .then(([directory, history]) => {
        if (isCancelled) return;
        setStaff(directory.items.find((s) => s.id === staffId) ?? null);
        setAttendance(history.slice(0, 5));
        setIsLoading(false);
      })
      .catch((e) => {
        if (isCancelled) return;
        setErrorMessage(describeError(e));
        setIsLoading(false);
      });

    // Kalau layar ditutup sebelum data datang, setState pada komponen yang
    // sudah dilepas percuma — flag ini membatalkannya.
    return () => {
      isCancelled = true;
    };
  }, [employee, staffId, attempt]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <RadialGlow size={250} color={c.glowHeader} top={-80} right={-50} />

      <View style={styles.headerRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBackAnimated(navigation)}
        >
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("stf.detail")}</Text>
      </View>

      <View style={styles.identity}>
        {isLoading ? (
          <>
            <Skeleton
              width={96}
              height={96}
              radius={48}
              color={c.onDark.track}
            />
            <Skeleton
              width={150}
              height={19}
              radius={6}
              color={c.onDark.track}
              style={{ marginTop: 15 }}
            />
            <Skeleton
              width={190}
              height={12}
              radius={4}
              color={c.onDark.track}
              style={{ marginTop: 9 }}
            />
          </>
        ) : staff ? (
          <>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{staff.initials}</Text>
            </View>
            <Text style={styles.name}>{staff.fullName}</Text>
            <Text style={styles.role}>
              {staff.jobTitle} · {staff.department}
            </Text>
            <Text style={styles.code}>{staff.code}</Text>
          </>
        ) : (
          <Text style={styles.role}>{t("stf.tidakDitemukan")}</Text>
        )}
      </View>
    </View>
  );

  if (errorMessage) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.body, styles.content]}>
          <ErrorState
            message={errorMessage}
            onRetry={() => {
              setErrorMessage(null);
              setIsLoading(true);
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      </View>
    );
  }

  if (isLoading || !staff) {
    return (
      <View style={styles.container}>
        {header}
        {isLoading && (
          <View style={[styles.body, styles.content]}>
            <View style={styles.sheet}>
              <Skeleton width="100%" height={44} radius={10} />
            </View>
            <View style={[styles.sheet, { marginTop: 12, gap: 11 }]}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="100%" height={13} radius={4} />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  const employmentInfo = [
    { k: t("stf.status"), v: staff.employment },
    { k: t("stf.tglMasuk"), v: formatShortDateWithYear(staff.joinDate) },
    { k: t("stf.atasan"), v: staff.manager },
    { k: t("stf.shift"), v: staff.shift },
  ];

  const contact = [
    { k: t("stf.emailKantor"), v: staff.email },
    { k: t("stf.telepon"), v: staff.phone },
  ];

  return (
    <View style={styles.container}>
      {header}

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <View style={styles.statCard}>
          <Stat
            value={`${formatDecimal(staff.attendanceRate)}%`}
            label={t("stf.kehadiran")}
          />
          <View style={styles.statDivider} />
          <Stat
            value={t("stf.hari", { n: staff.leaveLeft })}
            label={t("stf.sisaCuti")}
          />
          <View style={styles.statDivider} />
          <Stat
            value={formatDecimal(staff.kpiScore)}
            label={t("stf.skorKpi")}
          />
        </View>

        <View style={[styles.sheet, { marginTop: 12 }]}>
          <Text style={styles.sheetTitle}>{t("stf.dataKepeg")}</Text>
          <View style={styles.lines}>
            {employmentInfo.map((r) => (
              <Row key={r.k} k={r.k} v={r.v} />
            ))}
            <View style={styles.divider} />
            {contact.map((r) => (
              <Row key={r.k} k={r.k} v={r.v} />
            ))}
          </View>
        </View>

        <View style={[styles.sheet, { marginTop: 10 }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{t("stf.absen5")}</Text>
            <Pressable
              onPress={() =>
                navigation.navigate("StaffHistory", { staffId: staff.id })
              }
              hitSlop={8}
            >
              <Text style={styles.sheetLink}>{t("stf.semuaLink")}</Text>
            </Pressable>
          </View>

          <View style={{ gap: 10, marginTop: 13 }}>
            {attendance.map((a) => {
              const tone = c[ATTENDANCE_STATUS_TONE[a.status]];
              return (
                <View key={a.id} style={styles.attRow}>
                  <View style={styles.dateChip}>
                    <Text style={styles.dateDay}>
                      {formatNumericDate(a.date)}
                    </Text>
                    <Text style={styles.dateMonth}>
                      {getShortMonth(a.date)}
                    </Text>
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.attTime}>
                      {a.checkIn ?? "—"} — {a.checkOut ?? "—"}
                    </Text>
                    <Text style={styles.attDur}>{a.durationLabel ?? "—"}</Text>
                  </View>

                  <View style={[styles.attBadge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.attBadgeText, { color: tone.ink }]}>
                      {ATTENDANCE_STATUS_LABEL[a.status]}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("Approval")}
          >
            <Text style={styles.secondaryText}>
              {t("stf.riwayatPengajuan")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => Linking.openURL(`mailto:${staff.email}`)}
          >
            <Text style={styles.primaryText}>{t("stf.kirimPesan")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineKey}>{k}</Text>
      <Text style={styles.lineValue}>{v}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },

    header: {
      backgroundColor: c.headerBg,
      paddingHorizontal: 20,
      paddingBottom: 46,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      overflow: "hidden",
    },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.onDark.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" },

    identity: { alignItems: "center", marginTop: 16 },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.info.bg,
      borderWidth: 4,
      borderColor: c.onDark.track,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 30, fontWeight: "800", color: c.info.ink },
    name: {
      fontSize: 19,
      lineHeight: 23,
      fontWeight: "800",
      color: "#fff",
      marginTop: 13,
    },
    role: {
      fontSize: 12.5,
      fontWeight: "500",
      color: c.onDark.muted,
      marginTop: 5,
    },
    code: {
      fontSize: 10.5,
      fontWeight: "600",
      color: c.accentLight,
      marginTop: 7,
    },

    body: { flex: 1, marginTop: -28 },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 170,
    },

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
    statDivider: { width: 1, backgroundColor: c.hair },
    statValue: { fontSize: 17, fontWeight: "800", color: c.ink },
    statLabel: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 4,
    },

    sheet: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 22,
      padding: 16,
      shadowColor: "#0F1720",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    sheetHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    sheetTitle: { fontSize: 13.5, fontWeight: "700", color: c.ink },
    sheetLink: { fontSize: 11.5, fontWeight: "600", color: c.accent },

    lines: { gap: 11, marginTop: 13 },
    lineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    lineKey: { fontSize: 12.5, fontWeight: "500", color: c.muted },
    lineValue: {
      flexShrink: 1,
      fontSize: 12.5,
      fontWeight: "600",
      color: c.ink,
      textAlign: "right",
    },
    divider: { height: 1, backgroundColor: c.hair },

    attRow: { flexDirection: "row", alignItems: "center", gap: 11 },
    dateChip: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: c.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    dateDay: {
      fontSize: 12,
      lineHeight: 13,
      fontWeight: "800",
      color: c.ink,
    },
    dateMonth: {
      fontSize: 7.5,
      fontWeight: "600",
      color: c.muted,
      marginTop: 2,
    },
    attTime: { fontSize: 11.5, fontWeight: "600", color: c.ink },
    attDur: {
      fontSize: 10.5,
      fontWeight: "500",
      color: c.muted,
      marginTop: 3,
    },
    attBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    attBadgeText: { fontSize: 10, fontWeight: "700" },

    actions: { flexDirection: "row", gap: 9, marginTop: 12 },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 22,
      ...secondaryButtonStyle(c),
      alignItems: "center",
    },
    secondaryText: { fontSize: 12.5, fontWeight: "700", color: c.btnSoftInk },
    primaryBtn: {
      ...primaryButtonStyle(c),
      flex: 1,
      paddingVertical: 14,
      borderRadius: 22,
      backgroundColor: c.accent,
      alignItems: "center",
    },
    primaryText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  });
