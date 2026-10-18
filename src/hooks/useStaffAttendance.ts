import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { StaffAttendanceState, StaffDirectory } from "@/services/types";
import { formatShortDateWithYear, toISODate } from "@/utils/date";

export const ALL_TAB = "Semua";

export function useStaffAttendance() {
  const { employee } = useSession();
  const [directory, setDirectory] = useState<StaffDirectory | null>(null);
  const [tab, setTab] = useState<StaffAttendanceState>("attend");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_TAB);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    hrisApi
      .getStaffDirectory(employee.id)
      .then(setDirectory)
      .catch((e) => setErrorMessage(describeError(e)));
  }, [employee]);
  useFocusEffect(load);
  const items = useMemo(() => directory?.items ?? [], [directory]);
  const isLoading = directory === null && !errorMessage;
  const todayKey = formatShortDateWithYear(toISODate(new Date()));
  const chips = useMemo(() => {
    const nama: string[] = [];
    for (const s of items)
      if (!nama.includes(s.department)) nama.push(s.department);
    return [ALL_TAB, ...nama];
  }, [items]);
  const sameDepartmentStaff = items.filter(
    (s) => departmentFilter === ALL_TAB || s.department === departmentFilter,
  );
  const countTab = (k: StaffAttendanceState) =>
    sameDepartmentStaff.filter((s) => s.today.state === k).length;
  const filtered = sameDepartmentStaff.filter((s) => s.today.state === tab);
  return {
    directory,
    tab,
    setTab,
    departmentFilter,
    setDepartmentFilter,
    errorMessage,
    load,
    isLoading,
    todayKey,
    chips,
    countTab,
    filtered,
  };
}
