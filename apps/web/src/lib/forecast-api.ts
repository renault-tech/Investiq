import { apiClient } from "./api-client";

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

export async function getForecast(months = 6, accountId?: string): Promise<Forecast> {
  const res = await apiClient.get<Forecast>("/finance/forecast", {
    params: { months, account_id: accountId },
  });
  return res.data;
}
