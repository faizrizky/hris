import { useCallback, useState } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { useFocusEffect } from "@react-navigation/native";
import { useSession } from "@/services/session";
import { useActivePolling } from "@/hooks/useActivePolling";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { EmployeeDocument } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { DOC_CATEGORY_LABEL, DOC_STATUS_TONE } from "@/constants/statusLabels";
import { formatShortDateWithYear } from "@/utils/date";
import { pickProof } from "@/utils/pickProof";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";

export function useEmployeeDocumentDetail({ navigation, route }: ScreenProps) {
  const { employee } = useSession();
  const t = useT();
  const c = useTheme();
  const confirm = useConfirm();
  const [doc, setDoc] = useState<EmployeeDocument>(
    getRouteParams<{ doc: EmployeeDocument }>(route).doc,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [reason, setReason] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refresh = useCallback(() => {
    if (!employee) return;
    hrisApi
      .getDocuments(employee.id)
      .then((list) => {
        const baru = list.find((x) => x.id === doc.id);
        if (baru) setDoc(baru);
      })
      .catch(() => {});
  }, [employee, doc.id]);
  useFocusEffect(refresh);
  useActivePolling(
    refresh,
    20_000,
    doc.status === "pending" || doc.status === "changeRequested",
  );
  const isVerified = doc.status === "verified" || doc.status === "expiring";
  const canChange = doc.status === "pending" || doc.status === "rejected";
  const tone = c[DOC_STATUS_TONE[doc.status]];
  const submitChange = async () => {
    if (!reason.trim()) {
      setErrorMessage(t("dk.alasanWajib"));
      return;
    }
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.requestDocumentChange(doc.id, reason.trim());
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  const swap = async () => {
    const r = await pickProof();
    if (!r) return;
    if ("tooLargeSizeLabel" in r) {
      setErrorMessage(t("up.besarPesan", { ukuran: r.tooLargeSizeLabel }));
      return;
    }
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.replaceDocumentFile(doc.id, {
        uri: r.file.uri,
        name: r.file.name,
        mimeType: r.file.mimeType,
      });
      await confirm({
        title: t("dk.judul"),
        message: t("dk.gantiBerhasil"),
        tone: "info",
        confirmText: t("umum.mengerti"),
        cancelText: null,
      });
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  const info = isVerified
    ? t("dk.terverifikasiInfo")
    : doc.status === "changeRequested"
      ? t("dk.menungguHr")
      : doc.status === "rejected"
        ? t("dk.ditolakInfo")
        : t("dk.pendingInfo");
  const baris = [
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
  return {
    doc,
    isRequesting,
    setIsRequesting,
    reason,
    setReason,
    isSending,
    errorMessage,
    setErrorMessage,
    isVerified,
    canChange,
    tone,
    submitChange,
    swap,
    info,
    baris,
  };
}
