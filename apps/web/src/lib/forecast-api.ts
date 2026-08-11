import { apiClient } from "./api-client";
import { coerceNumbers, coerceNumbersInList } from "./coerce";

export interface ForecastMonth {
  month: string;              // "2026-09"
  committed_income: number;   // já aconteceu ou está agendado
  committed_expense: number;
  estimated_income: number;   // mediana de 6 meses, só onde falta cobertura conhecida
  estimated_expense: number;
  balance_committed: number;  // saldo acumulado só com o que é certo
  balance_realistic: number;  // saldo acumulado com o certo + a estimativa
}

export interface Forecast {
  current_balance: number;
  months: ForecastMonth[];
  negative_from: string | null;
}

const FORECAST_MONTH_NUMERIC = [
  "committed_income", "committed_expense", "estimated_income", "estimated_expense",
  "balance_committed", "balance_realistic",
] as const;

export async function getForecast(
  months = 6,
  accountId?: string | null,
  holder?: string | null
): Promise<Forecast> {
  const res = await apiClient.get<Forecast>("/finance/forecast", {
    params: { months, account_id: accountId || undefined, holder: holder || undefined },
  });
  const data = coerceNumbers(res.data, ["current_balance"] as const);
  return { ...data, months: coerceNumbersInList(data.months ?? [], FORECAST_MONTH_NUMERIC) };
}
