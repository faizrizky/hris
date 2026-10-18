import { useState } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { hrisApi } from "@/services/api";
import { ReviewStatus } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";

export function useDocumentReview({ route }: Pick<ScreenProps, "route">) {
  const initial: ReviewStatus | "all" =
    getRouteParams<{ status?: ReviewStatus | "all" }>(route).status ??
    "Pending";
  const [status, setStatus] = useState<ReviewStatus | "all">(initial);
  const [previousInitial, setPreviousInitial] = useState(initial);
  if (initial !== previousInitial) {
    setPreviousInitial(initial);
    setStatus(initial);
  }
  const documentItem = useLoad(
    () => hrisApi.getDocumentsForReview(status),
    status,
  );
  const items = documentItem.data ?? [];
  return { status, setStatus, documentItem, items };
}
