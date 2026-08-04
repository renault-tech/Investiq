import { useQuery } from "@tanstack/react-query";
import { getPortfolioIncome } from "@/lib/income-api";

export function usePortfolioIncome(portfolioId: string | null, year: number) {
  return useQuery({
    queryKey: ["portfolio-income", portfolioId, year],
    queryFn: () => getPortfolioIncome(portfolioId as string, year),
    enabled: portfolioId !== null,
    staleTime: 60_000,
  });
}
