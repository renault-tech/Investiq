import { apiClient } from "@/lib/api-client";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  is_default: boolean;
  created_at: string;
}

export interface PositionSummary {
  position_id: string;
  asset_id: string;
  ticker: string;
  asset_name: string;
  asset_type: string;
  broker: string | null;
  quantity: number;
  avg_cost: number;
  current_price: number | null;
  market_value_brl: number;
  cost_basis_brl: number;
  pnl_absolute: number;
  pnl_percent: number;
  weight: number;
  target_weight: number | null;
  rebalance_action: "buy" | "sell" | "hold" | null;
  rebalance_delta_units: number | null;
}

export interface PortfolioSummary {
  portfolio_id: string;
  portfolio_name: string;
  total_invested_brl: number;
  total_market_value_brl: number;
  total_pnl_absolute: number;
  total_pnl_percent: number;
  positions: PositionSummary[];
  rebalance_suggestions: unknown[];
}

export interface CreatePortfolioInput {
  name: string;
  description?: string;
  currency: string;
}

export interface AddPositionInput {
  ticker: string;
  broker?: string;
  target_weight?: number;
}

export interface CreateTransactionInput {
  position_id: string;
  transaction_type: "buy" | "sell" | "dividend" | "split" | "bonus";
  quantity: number;
  unit_price: number;
  fees: number;
  fx_rate: number;
  transaction_date: string;
  notes?: string;
}

// ─── Funções de API ──────────────────────────────────────────────────────────

export async function listPortfolios(): Promise<Portfolio[]> {
  const res = await apiClient.get<Portfolio[]>("/portfolios/");
  return res.data;
}

export async function createPortfolio(input: CreatePortfolioInput): Promise<Portfolio> {
  const res = await apiClient.post<Portfolio>("/portfolios/", input);
  return res.data;
}

export async function getPortfolioSummary(portfolioId: string): Promise<PortfolioSummary> {
  const res = await apiClient.get<PortfolioSummary>(`/portfolios/${portfolioId}/summary`);
  return res.data;
}

export async function addPosition(
  portfolioId: string,
  input: AddPositionInput
): Promise<unknown> {
  const res = await apiClient.post(`/portfolios/${portfolioId}/positions`, input);
  return res.data;
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<unknown> {
  const res = await apiClient.post("/portfolios/transactions", input);
  return res.data;
}

export async function deletePortfolio(portfolioId: string): Promise<void> {
  await apiClient.delete(`/portfolios/${portfolioId}`);
}

export async function updatePortfolio(portfolioId: string, name: string): Promise<void> {
  await apiClient.put(`/portfolios/${portfolioId}`, { name });
}
