import { apiClient } from "@/lib/api-client";
import { coerceNumbers, coerceNumbersInList } from "@/lib/coerce";

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
  currency: string;
  current_price: number | null;
  current_price_native: number | null;
  market_value_brl: number;
  market_value_native: number;
  cost_basis_brl: number;
  pnl_absolute: number;
  pnl_percent: number;
  weight: number;
  target_weight: number | null;
  rebalance_action: "buy" | "sell" | "hold" | null;
  rebalance_delta_units: number | null;
}

export interface AllocationSlice {
  asset_type: string;
  value: number;
  weight: number;
}

export interface PortfolioSummary {
  portfolio_id: string;
  portfolio_name: string;
  total_invested_brl: number;
  total_market_value_brl: number;
  total_pnl_absolute: number;
  total_pnl_percent: number;
  /** Retorno anualizado ponderado pelo dinheiro (XIRR) — considera quando
   * cada aporte entrou, diferente de total_pnl_percent (custo simples).
   * null quando não há fluxo de caixa suficiente pra calcular (carteira
   * sem aporte, ou sem cotação disponível pra avaliar a posição atual). */
  xirr_percent: number | null;
  positions: PositionSummary[];
  rebalance_suggestions: unknown[];
  allocation_by_type: AllocationSlice[];
}

export type PerformancePeriod = "1m" | "3m" | "6m" | "1y" | "max";

export interface PerformancePoint {
  date: string;
  total_value: number;
  total_invested: number;
}

export interface BenchmarkPoint {
  date: string;
  portfolio_pct: number;
  cdi_pct: number | null;
  ibov_pct: number | null;
  nasdaq_pct: number | null;
  sp500_pct: number | null;
}

export interface LookThroughBucket {
  label: string;
  value_brl: number;
  weight: number;
}

export interface PortfolioLookThrough {
  portfolio_id: string;
  total_market_value_brl: number;
  by_sector: LookThroughBucket[];
  by_country: LookThroughBucket[];
  by_asset_class: LookThroughBucket[];
  country_coverage: number;
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

export interface UpdatePositionInput {
  broker?: string | null;
  target_weight?: number | null;
}

/** Mesmos campos de CreateTransactionInput, todos opcionais — só o que
 * mudar é enviado. */
export type UpdateTransactionInput = Partial<Omit<CreateTransactionInput, "position_id">>;

// ─── Funções de API ──────────────────────────────────────────────────────────

export async function listPortfolios(): Promise<Portfolio[]> {
  const res = await apiClient.get<Portfolio[]>("/portfolios/");
  return res.data;
}

export async function createPortfolio(input: CreatePortfolioInput): Promise<Portfolio> {
  const res = await apiClient.post<Portfolio>("/portfolios/", input);
  return res.data;
}

// Pydantic serializa Decimal como string — coagir aqui, na fronteira, para
// os componentes poderem confiar nos tipos declarados acima (ver lib/coerce.ts).
const SUMMARY_NUMERIC = [
  "total_invested_brl", "total_market_value_brl", "total_pnl_absolute", "total_pnl_percent",
  "xirr_percent",
] as const;
const POSITION_NUMERIC = [
  "quantity", "avg_cost", "current_price", "current_price_native", "market_value_brl",
  "market_value_native", "cost_basis_brl",
  "pnl_absolute", "pnl_percent", "weight", "target_weight", "rebalance_delta_units",
] as const;
const ALLOCATION_NUMERIC = ["value", "weight"] as const;

export async function getPortfolioSummary(portfolioId: string): Promise<PortfolioSummary> {
  const res = await apiClient.get<PortfolioSummary>(`/portfolios/${portfolioId}/summary`);
  const data = coerceNumbers(res.data, SUMMARY_NUMERIC);
  return {
    ...data,
    positions: coerceNumbersInList(data.positions ?? [], POSITION_NUMERIC),
    allocation_by_type: coerceNumbersInList(data.allocation_by_type ?? [], ALLOCATION_NUMERIC),
  };
}

export async function getPortfolioPerformance(
  portfolioId: string,
  period: PerformancePeriod
): Promise<PerformancePoint[]> {
  const res = await apiClient.get<PerformancePoint[]>(
    `/portfolios/${portfolioId}/performance`,
    { params: { period } }
  );
  return coerceNumbersInList(res.data, ["total_value", "total_invested"] as const);
}

export async function getPortfolioBenchmark(
  portfolioId: string,
  period: PerformancePeriod
): Promise<BenchmarkPoint[]> {
  const res = await apiClient.get<BenchmarkPoint[]>(
    `/portfolios/${portfolioId}/benchmark`,
    { params: { period } }
  );
  return coerceNumbersInList(res.data, ["portfolio_pct", "cdi_pct", "ibov_pct"] as const);
}

const LOOK_THROUGH_NUMERIC = ["total_market_value_brl", "country_coverage"] as const;
const LOOK_THROUGH_BUCKET_NUMERIC = ["value_brl", "weight"] as const;

export async function getPortfolioLookThrough(portfolioId: string): Promise<PortfolioLookThrough> {
  const res = await apiClient.get<PortfolioLookThrough>(`/portfolios/${portfolioId}/look-through`);
  const data = coerceNumbers(res.data, LOOK_THROUGH_NUMERIC);
  return {
    ...data,
    by_sector: coerceNumbersInList(data.by_sector ?? [], LOOK_THROUGH_BUCKET_NUMERIC),
    by_country: coerceNumbersInList(data.by_country ?? [], LOOK_THROUGH_BUCKET_NUMERIC),
    by_asset_class: coerceNumbersInList(data.by_asset_class ?? [], LOOK_THROUGH_BUCKET_NUMERIC),
  };
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

export async function updatePosition(positionId: string, input: UpdatePositionInput): Promise<unknown> {
  const res = await apiClient.patch(`/portfolios/positions/${positionId}`, input);
  return res.data;
}

export async function deletePosition(positionId: string): Promise<void> {
  await apiClient.delete(`/portfolios/positions/${positionId}`);
}

export async function updateTransaction(
  transactionId: string,
  input: UpdateTransactionInput
): Promise<unknown> {
  const res = await apiClient.patch(`/portfolios/transactions/${transactionId}`, input);
  return res.data;
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  await apiClient.delete(`/portfolios/transactions/${transactionId}`);
}

export interface InvestmentTransaction {
  id: string;
  position_id: string;
  transaction_type: "buy" | "sell" | "dividend" | "split" | "bonus";
  quantity: number;
  unit_price: number;
  fees: number;
  fx_rate: number;
  total_amount: number;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

export async function listPositionTransactions(positionId: string): Promise<InvestmentTransaction[]> {
  const res = await apiClient.get<InvestmentTransaction[]>(`/portfolios/positions/${positionId}/transactions`);
  return coerceNumbersInList(res.data, ["quantity", "unit_price", "fees", "fx_rate", "total_amount"] as const);
}
