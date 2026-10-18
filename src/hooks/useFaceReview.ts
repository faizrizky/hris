import { useState } from "react";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import type { FaceReview } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { useConfirm } from "@/components/ConfirmDialog";
import { useT } from "@/i18n";

export function useFaceReview() {
  const t = useT();
  const confirm = useConfirm();
  const enrollmentList = useLoad(
    () => hrisApi.getFaceEnrollmentsForReview(),
    "wajah",
  );
  const items = enrollmentList.data ?? [];
  const [rejectTarget, setRejectTarget] = useState<FaceReview | null>(null);
  const [reason, setReason] = useState("");
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const decision = async (
    f: FaceReview,
    d: "approve" | "reject",
    note?: string,
  ) => {
    setSibuk(f.name);
    setErrorMessage(null);
    try {
      await hrisApi.decideFaceEnrollment(f.name, d, note);
      enrollmentList.retry();
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setSibuk(null);
    }
  };
  const approve = async (f: FaceReview) => {
    const isConfirmed = await confirm({
      title: t("fr.setujuiJudul"),
      message: t("fr.setujuiPesan", { nama: f.employeeName }),
      tone: "info",
      confirmText: t("fr.setujui"),
      cancelText: t("umum.batal"),
    });
    if (isConfirmed) await decision(f, "approve");
  };
  const submitReject = async () => {
    if (!rejectTarget) return;
    if (!reason.trim()) return setErrorMessage(t("fr.alasanWajib"));
    const f = rejectTarget;
    setRejectTarget(null);
    await decision(f, "reject", reason.trim());
    setReason("");
  };
  return {
    enrollmentList,
    items,
    rejectTarget,
    setRejectTarget,
    reason,
    setReason,
    sibuk,
    errorMessage,
    setErrorMessage,
    approve,
    submitReject,
  };
}
