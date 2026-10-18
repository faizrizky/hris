import { useEffect, useState } from "react";
import { getRouteParams, type ScreenProps } from "@/navigation/types";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { AttendanceRecord, Staff } from "@/services/types";

export function useStaffDetail({ route }: Pick<ScreenProps, "route">) {
  const { employee } = useSession();
  const { staffId } = getRouteParams<{ staffId: string }>(route);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        setAttendance(history.slice(0, 5));
        setIsLoading(false);
      })
      .catch((e) => {
        if (isCancelled) return;
        setErrorMessage(describeError(e));
        setIsLoading(false);
      });

    // Kalau layar ditutup sebelum data datang, setState pada komponen yang
    // sudah dilepas percuma — flag ini membatalkannya.
    return () => {
      isCancelled = true;
    };
  }, [employee, staffId, attempt]);
  return {
    staffId,
    staff,
    attendance,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    setAttempt,
  };
}
