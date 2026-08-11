import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/lib/analytics-api";

export function useAnalytics(months = 6, accountId?: string | null, holder?: string | null) {
  return useQuery({
    queryKey: ["finance", "analytics", months, accountId, holder],
    queryFn: () => getAnalytics(months, { accountId, holder }),
    staleTime: 60_000,
  });
}
