"use client";

import { useQuery } from "@tanstack/react-query";
import { getPortfolioSummary, type PortfolioSummary } from "@/lib/portfolio-api";

export function usePortfolioSummary(portfolioId: string | null) {
  return useQuery<PortfolioSummary>({
    queryKey: ["portfolio-summary", portfolioId],
    queryFn: () => getPortfolioSummary(portfolioId!),
    enabled: Boolean(portfolioId),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
