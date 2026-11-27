import { useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLoad } from "@/hooks/useLoad";
import { useT } from "@/i18n";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import type { HrFieldKey, HrServiceKind } from "@/services/types";

export function useHrService(kind: HrServiceKind) {
  const t = useT();
  const confirm = useConfirm();
  const service = useLoad(() => hrisApi.getHrService(kind), kind);
  const [values, setValues] = useState<Partial<Record<HrFieldKey, string>>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const setValue = (key: HrFieldKey, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  const submit = async () => {
    const isIncomplete = service.data?.fields.some(
      (field) => field.isRequired && !values[field.key]?.trim(),
    );
    if (isIncomplete) {
      setErrorMessage(t("hs.required"));
      return;
    }
    const isConfirmed = await confirm({
      title: t("hs.confirmTitle"),
      message: t("hs.confirm"),
      confirmText: t("hs.submit"),
      cancelText: t("umum.batal"),
    });
    if (!isConfirmed) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      // Koma desimal dari keyboard Indonesia.
      await hrisApi.submitHrService(kind, {
        ...values,
        ...(values.days ? { days: values.days.replace(",", ".") } : {}),
      });
      setValues({});
      service.retry();
    } catch (e) {
      setErrorMessage(describeError(e));
    } finally {
      setIsSending(false);
    }
  };

  return { service, values, setValue, submit, isSending, errorMessage };
}
