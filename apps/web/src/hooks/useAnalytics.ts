import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/lib/analytics-api";

export function useAnalytics(months = 6) {
  return useQuery({
    queryKey: ["finance", "analytics", months],
    queryFn: () => getAnalytics(months),
    staleTime: 60_000,
  });
}
