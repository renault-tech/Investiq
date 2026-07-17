import { useQuery } from "@tanstack/react-query";
import {
  getPortfolioPerformance,
  PerformancePeriod,
  PerformancePoint,
} from "@/lib/portfolio-api";

export function usePortfolioPerformance(
  portfolioId: string | null,
  period: PerformancePeriod
) {
  return useQuery<PerformancePoint[]>({
    queryKey: ["portfolio-performance", portfolioId, period],
    queryFn: () => getPortfolioPerformance(portfolioId as string, period),
    enabled: portfolioId !== null,
    staleTime: 5 * 60_000,
  });
}
