import { useCallback, useState } from "react";
import type { AppNavigation } from "@/navigation/types";
import { useActivePolling } from "@/hooks/useActivePolling";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useT } from "@/i18n";
import {
  FeedItem,
  ClockState,
  LeaveBalance,
  AttendanceRecord,
  EmploymentSlice,
} from "@/services/types";
import { describeError } from "@/services/api/http";
import { useConfirm } from "@/components/ConfirmDialog";
import { isTourSeen } from "@/components/Tour";

// Pengingat kelengkapan muncul sekali per akun setiap aplikasi dibuka.
let remindedEmployeeId: string | null = null;

const FACE_REMINDERS = {
  none: { title: "fe.belumJudul", message: "fe.belumIsi" },
  rejected: { title: "fe.ditolakJudul", message: "fe.ditolakIsi" },
  needs_reenroll: {
    title: "fe.pengingatJudul",
    message: "fe.perluDaftarUlang",
  },
} as const;

export function useHome() {
  const t = useT();
  const confirm = useConfirm();
  const { employee } = useSession();
  const [now, setNow] = useState(() => new Date());
  const navigation = useNavigation<AppNavigation>();
  const [notifications, setNotifications] = useState<FeedItem[] | null>(null);
  const [clock, setClock] = useState<ClockState | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [employment, setEmployment] = useState<EmploymentSlice[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canStartTour, setCanStartTour] = useState(false);
  // Berurutan: dua dialog sekaligus saling membatalkan. Perangkat yang belum melihat tutorial mendapatkannya dulu;
  // pengingat menyusul saat Beranda dibuka lagi.
  const remind = useCallback(
    async (employeeId: string) => {
      remindedEmployeeId = employeeId;
      try {
        const isSeenHere = await isTourSeen();
        const device = await hrisApi.registerDevice(isSeenHere);
        if (!isSeenHere && !device.isTutorialSeen) {
          remindedEmployeeId = null;
          setCanStartTour(true);
          return;
        }
        if (device.status === "Pending" || device.status === "Rejected") {
          await confirm({
            title: t("dv.judul"),
            message: t(
              device.status === "Pending" ? "dv.menunggu" : "dv.ditolak",
            ),
            tone: "warn",
            confirmText: t("dv.ok"),
            cancelText: null,
          });
        }
        const face = await hrisApi.getFaceStatus();
        if (face.state === "active" || face.state === "pending") return;
        const text = FACE_REMINDERS[face.state];
        const isOpen = await confirm({
          title: t(text.title),
          message: t(text.message, { tgl: face.graceUntil ?? "-" }),
          tone: "warn",
          confirmText: t("fe.daftarSekarang"),
          cancelText: t("fe.nanti"),
        });
        if (isOpen) navigation.navigate("Profil", { screen: "FaceEnroll" });
      } catch {
        remindedEmployeeId = null; // gagal jaringan: coba lagi pada fokus berikutnya
      }
    },
    [confirm, t, navigation],
  );
  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    Promise.all([
      hrisApi.getFeed(employee.id, employee.role),
      hrisApi.getClockState(employee.id),
      hrisApi.getLeaveBalances(employee.id),
      hrisApi.getAttendanceHistory(employee.id),
      hrisApi.getEmploymentSummary(employee.id),
    ])
      .then(
        ([
          notificationItem,
          clockState,
          leaveBalances,
          attendance,
          composition,
        ]) => {
          setNotifications(notificationItem);
          setClock(clockState);
          setBalances(leaveBalances);
          setHistory(attendance);
          setEmployment(composition);
        },
      )
      .catch((e) => setErrorMessage(describeError(e)));
    if (remindedEmployeeId !== employee.id) void remind(employee.id);
  }, [employee, remind]);
  useFocusEffect(load);
  const refreshClock = useCallback(() => {
    if (!employee) return;
    setNow(new Date());
    hrisApi
      .getClockState(employee.id)
      .then(setClock)
      .catch(() => {});
  }, [employee]);
  useActivePolling(refreshClock, 20_000, !!employee);
  return {
    now,
    navigation,
    notifications,
    clock,
    balances,
    history,
    employment,
    errorMessage,
    load,
    canStartTour,
  };
}
