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

export let hasShownFaceReminder = false;

export let hasShownDeviceReminder = false;

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
      .then(([notif, clockState, leaveBalances, attendance, komposisi]) => {
        setNotifications(notif);
        setClock(clockState);
        setBalances(leaveBalances);
        setHistory(attendance);
        setEmployment(komposisi);
      })
      .catch((e) => setErrorMessage(describeError(e)));
    if (!hasShownDeviceReminder) {
      hrisApi
        .registerDevice()
        .then((d) => {
          if (d.status !== "Pending" && d.status !== "Rejected") return;
          hasShownDeviceReminder = true;
          confirm({
            title: t("dv.judul"),
            message: t(d.status === "Pending" ? "dv.menunggu" : "dv.ditolak"),
            tone: "warn",
            confirmText: t("dv.ok"),
            cancelText: t("fe.nanti"),
          });
        })
        .catch(() => {});
    }
    if (!hasShownFaceReminder) {
      hrisApi
        .getFaceStatus()
        .then(async (f) => {
          if (f.state !== "needs_reenroll" || hasShownFaceReminder) return;
          hasShownFaceReminder = true;
          const isOpen = await confirm({
            title: t("fe.pengingatJudul"),
            message: t("fe.perluDaftarUlang", { tgl: f.graceUntil ?? "-" }),
            tone: "warn",
            confirmText: t("fe.daftarUlang"),
            cancelText: t("fe.nanti"),
          });
          if (isOpen) navigation.navigate("Profil", { screen: "FaceEnroll" });
        })
        .catch(() => {});
    }
  }, [employee, confirm, t, navigation]);
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
  };
}
