import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { useLoad } from "@/hooks/useLoad";

export function usePayslipList() {
  const { employee } = useSession();
  const slip = useLoad(
    () => (employee ? hrisApi.getPayslips(employee.id) : Promise.resolve([])),
    employee?.id,
  );
  const payslips = slip.data;
  const isPayslipLoading = slip.isLoading;
  const latest = payslips?.[0];
  const previous = payslips?.slice(1) ?? [];
  return { slip, payslips, isPayslipLoading, latest, previous };
}
