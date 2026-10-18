import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { useLoad } from "@/hooks/useLoad";

export function useLeaveList() {
  const { employee } = useSession();
  const balanceList = useLoad(
    () =>
      employee ? hrisApi.getLeaveBalances(employee.id) : Promise.resolve([]),
    employee?.id,
  );
  const submission = useLoad(
    () =>
      employee ? hrisApi.getLeaveRequests(employee.id) : Promise.resolve([]),
    employee?.id,
  );
  const balances = balanceList.data;
  const requests = submission.data;
  const errorMessage = balanceList.error ?? submission.error;
  const retryLoad = () => {
    balanceList.retry();
    submission.retry();
  };
  return { balances, requests, errorMessage, retryLoad };
}
