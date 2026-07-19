import { apiClient } from "./api-client";

export interface MonthlyIncomePoint {
  month: string;
  amount: number;
}

export interface AssetIncomeSummary {
  ticker: string;
  total_12m: number;
  yield_on_cost: number;
}

export interface PortfolioIncome {
  year: number;
  total: number;
  monthly_series: MonthlyIncomePoint[];
  by_asset: AssetIncomeSummary[];
}

export async function getPortfolioIncome(portfolioId: string, year: number): Promise<PortfolioIncome> {
  const res = await apiClient.get<PortfolioIncome>(`/portfolios/${portfolioId}/income`, {
    params: { year },
  });
  return res.data;
}
