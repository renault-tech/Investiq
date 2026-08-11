import { apiClient } from "./api-client";
import { coerceNumbers, coerceNumbersInList } from "./coerce";

export interface SavingsPoint {
  month: string;
  income: number;
  expense: number;
  savings_rate: number | null;   // fração; null quando não houve receita
}

export interface CategoryTrend {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
  current_amount: number;
  baseline_median: number;
  pct_change: number | null;     // fração; null quando a categoria é nova
  direction: "up" | "down" | "stable";
}

export interface CategoryMatrixRow {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
  values: number[];              // alinhado a Analytics.months
}

export interface Analytics {
  months: string[];
  burn_rate: number;
  savings_series: SavingsPoint[];
  runway_months: number | null;
  category_trends: CategoryTrend[];
  category_matrix: CategoryMatrixRow[];
}

export async function getAnalytics(
  months = 6,
  scope?: { accountId?: string | null; holder?: string | null }
): Promise<Analytics> {
  const res = await apiClient.get<Analytics>("/finance/analytics", {
    params: { months, account_id: scope?.accountId || undefined, holder: scope?.holder || undefined },
  });
  const data = coerceNumbers(res.data, ["burn_rate", "runway_months"] as const);
  return {
    ...data,
    savings_series: coerceNumbersInList(data.savings_series ?? [], ["income", "expense", "savings_rate"] as const),
    category_trends: coerceNumbersInList(data.category_trends ?? [], ["current_amount", "baseline_median", "pct_change"] as const),
  };
}
