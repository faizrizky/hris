import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { hrisApi } from "@/services/api";
import { describeError } from "@/services/api/http";
import { useSession } from "@/services/session";
import { OvertimeRecord } from "@/services/types";
import {
  OVERTIME_LIMIT_HOURS,
  OVERTIME_PAY_PER_HOUR,
} from "@/constants/payroll";
import { toISODate } from "@/utils/date";

export function useOvertime() {
  const { employee } = useSession();
  const [records, setRecords] = useState<OvertimeRecord[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!employee) return;
    setErrorMessage(null);
    hrisApi
      .getOvertimes(employee.id)
      .then(setRecords)
      .catch((e) => setErrorMessage(describeError(e)));
  }, [employee]);
  useFocusEffect(load);
  const thisMonth = toISODate(new Date()).slice(0, 7);
  const monthly =
    records === null
      ? []
      : records.filter((r) => r.date.slice(0, 7) === thisMonth);
  const totalJam = monthly.reduce((a, r) => a + r.hours, 0);
  const jam = Math.floor(totalJam);
  const minutes = Math.round((totalJam % 1) * 60);
  const percent = Math.min(100, (totalJam / OVERTIME_LIMIT_HOURS) * 100);
  const estimate = totalJam * OVERTIME_PAY_PER_HOUR;
  const isTight = totalJam >= OVERTIME_LIMIT_HOURS * 0.8;
  return {
    records,
    errorMessage,
    load,
    jam,
    minutes,
    percent,
    estimate,
    isTight,
  };
}
