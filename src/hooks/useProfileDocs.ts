import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { DocCategory, EmployeeDocument } from "@/services/types";
import { useActivePolling } from "@/hooks/useActivePolling";

export const ALL_TAB = "semua";

export function useProfileDocs() {
  const { employee } = useSession();
  const [docs, setDocs] = useState<EmployeeDocument[] | null>(null);
  const [tab, setTab] = useState<DocCategory | typeof ALL_TAB>(ALL_TAB);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    hrisApi
      .getDocuments(employee.id)
      .then(setDocs)
      .catch((e) => setErrorMessage(describeError(e)));
  }, [employee]);
  const loadQuietly = useCallback(() => {
    if (!employee) return;
    hrisApi
      .getDocuments(employee.id)
      .then(setDocs)
      .catch(() => {});
  }, [employee]);
  useFocusEffect(load);
  useActivePolling(
    loadQuietly,
    20_000,
    (docs ?? []).some(
      (d) => d.status === "pending" || d.status === "changeRequested",
    ),
  );
  const items = docs ?? [];
  const isLoading = docs === null && !errorMessage;
  const verifiedCount = items.filter((d) => d.status === "verified").length;
  const needsAction = items.length - verifiedCount;
  const countBy = (k: DocCategory | typeof ALL_TAB) =>
    k === ALL_TAB ? items.length : items.filter((d) => d.category === k).length;
  const filtered = items.filter((d) => tab === ALL_TAB || d.category === tab);
  return {
    docs,
    tab,
    setTab,
    errorMessage,
    load,
    items,
    isLoading,
    verifiedCount,
    needsAction,
    countBy,
    filtered,
  };
}
