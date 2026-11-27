import { useEffect, useState, useRef } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeContext";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { FeedbackForm } from "@/services/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { useT } from "@/i18n";
import { goBackAnimated } from "@/navigation/navigationBack";

export function useAppraisalFeedback({ navigation, route }: ScreenProps) {
  const t = useT();
  const c = useTheme();
  const confirm = useConfirm();
  const { employeeId, employeeName, isSelf } = getRouteParams<{
    employeeId: string;
    employeeName: string;
    isSelf?: boolean; // penilaian diri: disimpan ke Appraisal, bisa diubah sampai difinalkan HR
  }>(route);
  const triggerRef = useRef<View>(null);
  const [form, setForm] = useState<FeedbackForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ratingValue, setRatingValue] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useEffect(() => {
    let isCancelled = false;
    hrisApi
      .getFeedbackForm(employeeId)
      .then((f) => {
        if (isCancelled) return;
        setForm(f);
        setRatingValue(
          f.mine?.ratings ??
            Object.fromEntries(f.criteria.map((k) => [k.name, 3])),
        );
        setNote(f.mine?.feedback ?? "");
      })
      .catch((e) => !isCancelled && setLoadError(describeError(e)));
    return () => {
      isCancelled = true;
    };
  }, [employeeId, attempt]);
  const isSubmitted = form?.mine?.status === "submitted";
  const totalWeight = form?.criteria.reduce((a, k) => a + k.weight, 0) ?? 0;
  const score = form
    ? form.criteria.reduce(
        (a, k) =>
          a +
          (ratingValue[k.name] ?? 0) *
            (totalWeight ? k.weight / totalWeight : 0),
        0,
      )
    : 0;
  const update = (k: string, d: number) =>
    setRatingValue((p) => ({
      ...p,
      [k]: Math.min(5, Math.max(0, (p[k] ?? 0) + d)),
    }));
  const save = async (shouldSubmit: boolean) => {
    if (!note.trim()) {
      setErrorMessage(t("fb.catatanWajib"));
      return;
    }
    if (shouldSubmit) {
      const isConfirmed = await confirm({
        title: t("fb.kirimJudul"),
        message: t("fb.kirimPesan", { nama: employeeName }),
        tone: "warn",
        confirmText: t("fb.kirim"),
        cancelText: t("umum.batal"),
        from: triggerRef,
        fromColor: c.accent,
        fromTextColor: "#FFFFFF",
        fromLabel: t("fb.kirim"),
        fromRadius: 14,
      });
      if (!isConfirmed) return;
    }
    setIsSending(true);
    setErrorMessage(null);
    try {
      await hrisApi.submitFeedback({
        employeeId,
        ratings: ratingValue,
        feedback: note.trim(),
        submit: shouldSubmit,
      });
      goBackAnimated(navigation);
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };
  return {
    employeeName,
    isSelf,
    triggerRef,
    form,
    loadError,
    setLoadError,
    setAttempt,
    ratingValue,
    note,
    setNote,
    isSending,
    errorMessage,
    isSubmitted,
    score,
    update,
    save,
  };
}
