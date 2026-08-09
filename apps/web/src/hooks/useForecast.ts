import { useQuery } from "@tanstack/react-query";
import { getForecast } from "@/lib/forecast-api";

export function useForecast(months = 6, accountId?: string) {
  return useQuery({
    queryKey: ["finance", "forecast", months, accountId],
    queryFn: () => getForecast(months, accountId),
    staleTime: 60_000,
  });
}
