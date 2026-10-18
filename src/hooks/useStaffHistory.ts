import { useEffect, useState } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { AttendanceRecord, Staff } from "@/services/types";

export function useStaffHistory({ route }: Pick<ScreenProps, "route">) {
  const { employee } = useSession();
  const { staffId } = getRouteParams<{ staffId: string }>(route);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!employee) return;
    let isCancelled = false;

    Promise.all([
      hrisApi.getStaffDirectory(employee.id),
      hrisApi.getStaffAttendanceHistory(staffId),
    ])
      .then(([directory, history]) => {
        if (isCancelled) return;
        setStaff(directory.items.find((s) => s.id === staffId) ?? null);
        setRecords(history);
      })
      .catch((e) => {
        if (!isCancelled) setErrorMessage(describeError(e));
      });

    return () => {
      isCancelled = true;
    };
  }, [employee, staffId, attempt]);
  const isLoading = records === null && !errorMessage;
  const items = records ?? [];
  const countBy = (s: AttendanceRecord["status"]) =>
    items.filter((r) => r.status === s).length;
  return {
    staff,
    errorMessage,
    setErrorMessage,
    setAttempt,
    isLoading,
    items,
    countBy,
  };
}
