import { useQuery } from "@tanstack/react-query";
import {
  getPortfolioBenchmark,
  BenchmarkPoint,
  PerformancePeriod,
} from "@/lib/portfolio-api";

export function usePortfolioBenchmark(
  portfolioId: string | null,
  period: PerformancePeriod
) {
  return useQuery<BenchmarkPoint[]>({
    queryKey: ["portfolio-benchmark", portfolioId, period],
    queryFn: () => getPortfolioBenchmark(portfolioId as string, period),
    enabled: portfolioId !== null,
    staleTime: 5 * 60_000,
  });
}
