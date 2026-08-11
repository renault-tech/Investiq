import { useQuery } from "@tanstack/react-query";
import { getForecast } from "@/lib/forecast-api";

export function useForecast(months = 6, accountId?: string | null, holder?: string | null) {
  return useQuery({
    queryKey: ["finance", "forecast", months, accountId, holder],
    queryFn: () => getForecast(months, accountId, holder),
    staleTime: 60_000,
  });
}
