import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { StaffDirectory } from "@/services/types";
import { useT } from "@/i18n";

export const ALL_TAB = "Semua";

export function useStaffList() {
  const t = useT();
  const { employee } = useSession();
  const [directory, setDirectory] = useState<StaffDirectory | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState(ALL_TAB);
  const [search, setSearch] = useState("");
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
  const chips = useMemo(() => {
    const nama: string[] = [];
    for (const s of items)
      if (!nama.includes(s.department)) nama.push(s.department);
    return [ALL_TAB, ...nama];
  }, [items]);
  const countDepartment = (d: string) =>
    d === ALL_TAB
      ? items.length
      : items.filter((s) => s.department === d).length;
  const q = search.trim().toLowerCase();
  const filtered = items.filter((s) => {
    const isMatchingDepartment =
      departmentFilter === ALL_TAB || s.department === departmentFilter;
    const isMatchingSearch =
      q === "" ||
      s.fullName.toLowerCase().includes(q) ||
      s.jobTitle.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q);
    return isMatchingDepartment && isMatchingSearch;
  });
  const scope =
    employee?.role === "hr"
      ? t("stf.dariAktif", {
          n: items.length,
          total: directory?.totalActive ?? 0,
        })
      : t("stf.bawahan", { n: items.length });
  return {
    directory,
    departmentFilter,
    setDepartmentFilter,
    search,
    setSearch,
    errorMessage,
    load,
    isLoading,
    chips,
    countDepartment,
    q,
    filtered,
    scope,
  };
}
