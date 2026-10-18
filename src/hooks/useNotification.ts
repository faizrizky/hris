import { useCallback, useEffect, useState } from "react";
import type { ScreenProps } from "@/navigation/types";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { AppNotification } from "@/services/types";
import { setUnreadCount } from "@/navigation/notifBadge";

export function useNotification({
  navigation,
}: Pick<ScreenProps, "navigation">) {
  const { employee } = useSession();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    hrisApi
      .getNotificationInbox(employee.id)
      .then(setItems)
      .catch((e) => setErrorMessage(describeError(e)));
  }, [employee]);
  useFocusEffect(load);
  const unreadCount = items === null ? 0 : items.filter((n) => !n.read).length;
  useEffect(() => {
    if (items !== null) setUnreadCount(unreadCount);
  }, [items, unreadCount]);
  const markRead = (ids?: string[]) => {
    if (!employee) return;
    hrisApi
      .markNotificationsRead(employee.id, ids)
      .then(setItems)
      // Gagal menandai dibaca tidak kritis; daftar tetap seperti semula.
      .catch(() => {});
  };
  const open = async (n: AppNotification) => {
    if (!n.read) markRead([n.id]);
    const isSupervisor = employee?.role === "mss" || employee?.role === "hr";
    const isPending = n.tone === "warn" && isSupervisor;
    switch (n.documentType) {
      case "Employee Document":
        // HR meninjau di layar verifikasi; karyawan melihat daftar dokumennya.
        if (employee?.role === "hr" && n.tone === "warn") {
          // Buka tab sesuai konteks: permintaan ubah dokumen -> "Perubahan", lainnya -> "Menunggu".
          navigation.navigate("DocumentReview", {
            status:
              n.documentStatus === "Change Requested"
                ? "Change Requested"
                : "Pending",
          });
        } else {
          navigation.navigate("Profil", { screen: "ProfileDocs" });
        }
        return;
      case "Employee Checkin":
        if (isPending) navigation.navigate("OfflineReview");
        return;
      case "Face Enrollment":
        // HR meninjau di web; karyawan membuka layar pendaftaran wajahnya.
        if (employee?.role !== "hr") {
          navigation.navigate("Profil", { screen: "FaceEnroll" });
        }
        return;
      case "HR Announcement":
        navigation.navigate("Announcements", { id: n.documentName });
        return;
      case "Profile Change Request":
        if (employee?.role === "hr" && n.tone === "warn") {
          navigation.navigate("ProfileChangeReview");
        } else {
          navigation.navigate("Profil", { screen: "ProfileData" });
        }
        return;
      case "Leave Application":
      case "Overtime Request":
      case "Travel Request":
      case "WFH Schedule":
      case "Attendance Request":
        if (isPending) {
          navigation.navigate("Approval");
          return;
        }
        if (n.documentType === "Attendance Request") {
          navigation.navigate("AttendanceCorrectionHistory");
        } else if (n.documentType === "Overtime Request") {
          navigation.navigate("Overtime");
        } else {
          navigation.navigate("LeaveList");
        }
        return;
    }
  };
  const groups: string[] = [];
  for (const n of items ?? [])
    if (!groups.includes(n.group)) groups.push(n.group);
  return { items, errorMessage, load, unreadCount, markRead, open, groups };
}
