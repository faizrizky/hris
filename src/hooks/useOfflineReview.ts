import { useState } from "react";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { OfflineCheckin, OfflineReviewStatus } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { useSession } from "@/services/session";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatShortDate } from "@/utils/date";
import { useT } from "@/i18n";

export function formatTime(s: string | null): string {
  if (!s) return "—";
  const [tgl, jam = ""] = s.replace("T", " ").split(" ");
  return `${formatShortDate(tgl!)} · ${jam.slice(0, 5)}`;
}

export function useOfflineReview() {
  const t = useT();
  const { employee } = useSession();
  const confirm = useConfirm();
  const [status, setStatus] = useState<OfflineReviewStatus | "all">(
    "Needs Review",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const checkinList = useLoad(
    () =>
      hrisApi.getOfflineCheckins(
        status,
        employee?.role === "mss" ? "team" : undefined,
      ),
    `${status}-${employee?.role}`,
  );
  const items = checkinList.data ?? [];
  const decide = async (x: OfflineCheckin, decision: "approve" | "reject") => {
    if (decision === "approve") {
      const isConfirmed = await confirm({
        title: t(x.claimedTime ? "ofr.setujuiJudul" : "ofr.terimaJudul"),
        message: x.claimedTime
          ? t("ofr.setujuiPesan", { jam: formatTime(x.claimedTime) })
          : t("ofr.terimaPesan"),
        tone: "info",
        confirmText: t("pcr.setujui"),
        cancelText: t("umum.batal"),
      });
      if (!isConfirmed) return;
    }
    setBusy(x.id);
    setErrorMessage(null);
    try {
      await hrisApi.decideOfflineCheckin(x.id, decision);
      checkinList.retry();
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setBusy(null);
    }
  };
  return { status, setStatus, busy, errorMessage, checkinList, items, decide };
}
