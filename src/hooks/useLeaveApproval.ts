import { useCallback, useState, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { LeaveRequest } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { describeError } from "@/services/api/http";
import { useT } from "@/i18n";

export function useLeaveApproval() {
  const { employee } = useSession();
  const c = useTheme();
  const confirm = useConfirm();
  const t = useT();
  const [items, setItems] = useState<LeaveRequest[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const triggerRef = useRef<View>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingData, setPendingData] = useState(0);
  const [pendingDocs, setPendingDocs] = useState(0);
  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    hrisApi
      .getPendingApprovals(employee.id)
      .then(setItems)
      .catch((e) => setErrorMessage(describeError(e)));
    // HR juga memutuskan permintaan perubahan data pribadi dan foto profil.
    if (employee.role === "hr") {
      hrisApi
        .getProfileChangesForReview("Pending")
        .then((l) => setPendingData(l.length))
        .catch(() => setPendingData(0));
      // Dokumen baru dan permintaan ubah dokumen sama-sama menunggu keputusan HR.
      Promise.all([
        hrisApi.getDocumentsForReview("Pending"),
        hrisApi.getDocumentsForReview("Change Requested"),
      ])
        .then(([a, b]) => setPendingDocs(a.length + b.length))
        .catch(() => setPendingDocs(0));
    }
  }, [employee]);
  useFocusEffect(load);
  const decide = async (id: string, decision: "approve" | "reject") => {
    try {
      const updated = await hrisApi.decideLeaveRequest(id, decision);
      setItems((prev) => (prev ?? []).map((r) => (r.id === id ? updated : r)));
      return true;
    } catch (e) {
      void confirm({
        title: t("umum.gagalMemproses"),
        message: describeError(e),
        tone: "bad",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      return false;
    }
  };
  const approveAll = async () => {
    const antre = (items ?? []).filter((r) => r.decision === null);
    const isConfirmed = await confirm({
      title: t("ap.setujuiN", { n: antre.length }),
      message: t("ap.setujuiPesan"),
      tone: "warn",
      confirmText: t("ap.setujuiSemua"),
      cancelText: t("umum.batal"),
      from: triggerRef,
      fromColor: c.accent,
      fromTextColor: "#FFFFFF",
      fromLabel: t("ap.setujuiSemua"),
      fromRadius: 999,
    });
    if (!isConfirmed) return;
    setIsBusy(true);
    try {
      for (const item of antre) {
        if (!(await decide(item.id, "approve"))) break; // berhenti di galat pertama
      }
    } finally {
      setIsBusy(false);
    }
  };
  return {
    items,
    isBusy,
    triggerRef,
    errorMessage,
    pendingData,
    pendingDocs,
    load,
    decide,
    approveAll,
  };
}
