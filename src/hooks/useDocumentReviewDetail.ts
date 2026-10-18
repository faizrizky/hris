import { useState, useRef } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { ReviewDocument } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { DOC_CATEGORY_LABEL } from "@/constants/statusLabels";
import { formatShortDateWithYear } from "@/utils/date";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";

export function useDocumentReviewDetail({ navigation, route }: ScreenProps) {
  const t = useT();
  const c = useTheme();
  const confirm = useConfirm();
  const doc: ReviewDocument = getRouteParams<{ doc: ReviewDocument }>(
    route,
  ).doc;
  const triggerRef = useRef<View>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const decide = async (
    decision: "verify" | "reject" | "allow_change" | "deny_change",
  ) => {
    if (decision === "reject" && !reason.trim()) {
      setErrorMessage(t("rv.alasanWajib"));
      return;
    }
    if (decision === "verify" || decision === "allow_change") {
      const isVerifyDecision = decision === "verify";
      const isConfirmed = await confirm({
        title: t(isVerifyDecision ? "rv.verifikasiJudul" : "rv.izinkanJudul"),
        message: t(
          isVerifyDecision ? "rv.verifikasiPesan" : "rv.izinkanPesan",
          {
            nama: doc.employeeName,
          },
        ),
        tone: "info",
        confirmText: t(isVerifyDecision ? "rv.verifikasi" : "rv.izinkanUbah"),
        cancelText: t("umum.batal"),
        from: triggerRef,
        fromColor: c.accent,
        fromTextColor: "#FFFFFF",
        fromLabel: t(isVerifyDecision ? "rv.verifikasi" : "rv.izinkanUbah"),
        fromRadius: 14,
      });
      if (!isConfirmed) return;
    }
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.decideDocument(
        doc.id,
        decision,
        reason.trim() || undefined,
      );
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  const baris = [
    { k: t("rv.karyawan"), v: doc.employeeName },
    {
      k: t("rv.jabatan"),
      v: [doc.designation, doc.department].filter(Boolean).join(" · ") || "—",
    },
    { k: t("rv.kategori"), v: DOC_CATEGORY_LABEL[doc.category] },
    { k: t("rv.ukuran"), v: `${doc.ext} · ${doc.sizeLabel}` },
    {
      k: t("rv.tglUnggah"),
      v: doc.uploadedOn ? formatShortDateWithYear(doc.uploadedOn) : "—",
    },
    {
      k: t("rv.berlaku"),
      v: doc.expiresOn ? formatShortDateWithYear(doc.expiresOn) : "—",
    },
  ];
  const isPending = doc.status === "Pending";
  const isChangeRequested = doc.status === "Change Requested";
  return {
    doc,
    triggerRef,
    isRejecting,
    setIsRejecting,
    reason,
    setReason,
    isSending,
    errorMessage,
    setErrorMessage,
    decide,
    baris,
    isPending,
    isChangeRequested,
  };
}
