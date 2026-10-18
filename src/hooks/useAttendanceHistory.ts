import { useState } from "react";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { AttendanceStatus } from "@/services/types";
import { useLoad } from "@/hooks/useLoad";
import { getMonthName } from "@/utils/date";
import { useT, getActiveLanguage } from "@/i18n";

export type Filter = "semua" | "telat" | "izin";

export function useAttendanceHistory() {
  const t = useT();
  const { employee } = useSession();
  const history = useLoad(
    () =>
      employee
        ? hrisApi.getAttendanceHistory(employee.id)
        : Promise.resolve([]),
    employee?.id,
  );
  const records = history.data;
  const [filter, setFilter] = useState<Filter>("semua");
  const isMemuat = history.isLoading;
  const all = records ?? [];
  const count = (s: AttendanceStatus) =>
    all.filter((r) => r.status === s).length;
  const presentCount = count("hadir");
  const lateMinutes = count("telat");
  const permission = count("izin");
  const percent = all.length
    ? `${(((presentCount + lateMinutes) / all.length) * 100).toFixed(1).replace(".", getActiveLanguage() === "en" ? "." : ",")}%`
    : "–";
  const filtered = all.filter((r) => filter === "semua" || r.status === filter);
  const chips: { key: Filter; label: string }[] = [
    { key: "semua", label: getMonthName() },
    { key: "telat", label: t("ab.telatN", { n: lateMinutes }) },
    { key: "izin", label: t("ab.izinN", { n: permission }) },
  ];
  return {
    history,
    records,
    filter,
    setFilter,
    isMemuat,
    presentCount,
    lateMinutes,
    permission,
    percent,
    filtered,
    chips,
  };
}
