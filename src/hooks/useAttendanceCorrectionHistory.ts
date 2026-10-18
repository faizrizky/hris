import { useState } from "react";
import { useLoad } from "@/hooks/useLoad";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { AttendanceRequestedStatus } from "@/services/types";

export type Filter = "semua" | AttendanceRequestedStatus;

export function useAttendanceCorrectionHistory() {
  const { employee } = useSession();
  const correction = useLoad(
    () =>
      employee
        ? hrisApi.getAttendanceCorrections(employee.id)
        : Promise.resolve([]),
    employee?.id,
  );
  const records = correction.data;
  const [filter, setFilter] = useState<Filter>("semua");
  const [openId, setOpenId] = useState<string | null>(null);
  const isLoadingCorrections = correction.isLoading;
  const all = records ?? [];
  const countBy = (s: AttendanceRequestedStatus) =>
    all.filter((r) => r.status === s).length;
  const pending = countBy("pending");
  const approved = countBy("approved");
  const rejected = countBy("rejected");
  const total = all.length;
  const filtered = all.filter((r) => filter === "semua" || r.status === filter);
  return {
    correction,
    records,
    filter,
    setFilter,
    openId,
    setOpenId,
    isLoadingCorrections,
    countBy,
    pending,
    approved,
    rejected,
    total,
    filtered,
  };
}
