"use client";

import { useQuery } from "@tanstack/react-query";
import { getPortfolioLookThrough, type PortfolioLookThrough } from "@/lib/portfolio-api";

export function usePortfolioLookThrough(portfolioId: string | null) {
  return useQuery<PortfolioLookThrough>({
    queryKey: ["portfolio-look-through", portfolioId],
    queryFn: () => getPortfolioLookThrough(portfolioId!),
    enabled: Boolean(portfolioId),
    staleTime: 5 * 60_000,
  });
}
