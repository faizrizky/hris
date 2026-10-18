import { useState, useRef } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { ProfileChange } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";

export function useProfileChangeReviewDetail({
  navigation,
  route,
}: ScreenProps) {
  const t = useT();
  const c = useTheme();
  const confirm = useConfirm();
  const p: ProfileChange = getRouteParams<{ change: ProfileChange }>(
    route,
  ).change;
  const triggerRef = useRef<View>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isPending = p.status === "Pending";
  const decide = async (decision: "approve" | "reject") => {
    if (decision === "reject" && !note.trim()) {
      setErrorMessage(t("pcr.alasanTolakWajib"));
      return;
    }
    if (decision === "approve") {
      const isConfirmed = await confirm({
        title: t("pcr.setujuiJudul"),
        message: t("pcr.setujuiPesan", { nama: p.employeeName ?? "—" }),
        tone: "info",
        confirmText: t("pcr.setujui"),
        cancelText: t("umum.batal"),
        from: triggerRef,
        fromColor: c.accent,
        fromTextColor: "#FFFFFF",
        fromLabel: t("pcr.setujui"),
        fromRadius: 14,
      });
      if (!isConfirmed) return;
    }
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.decideProfileChange(
        p.id,
        decision,
        note.trim() || undefined,
      );
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  return {
    p,
    triggerRef,
    isRejecting,
    setIsRejecting,
    note,
    setNote,
    isSending,
    errorMessage,
    setErrorMessage,
    isPending,
    decide,
  };
}
