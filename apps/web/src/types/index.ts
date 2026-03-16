// ── Auth ──────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  plan: string
  is_verified: boolean
}

// ── Portfolio ─────────────────────────────────────────────
export type AssetType = "stock" | "reit" | "crypto" | "etf" | "bond"

export interface Position {
  id: string
  ticker: string
  name: string
  asset_type: AssetType
  quantity: number
  avg_cost: number
  current_price: number
  current_value: number
  total_invested: number
  pnl: number
  pnl_pct: number
  portfolio_weight: number
}

export interface PortfolioSummary {
  total_value: number
  total_invested: number
  total_pnl: number
  total_pnl_pct: number
  day_change: number
  day_change_pct: number
  positions_count: number
}

export interface RebalanceSuggestion {
  ticker: string
  name: string
  current_weight: number
  target_weight: number
  diff: number
  action: "buy" | "sell" | "hold"
  quantity: number
  value: number
}

// ── Finance ──────────────────────────────────────────────
export type TransactionType = "income" | "expense"

export interface FinancialTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: TransactionType
  category_name: string
  category_color: string
  account: string
}

export interface CategorySummary {
  name: string
  amount: number
  color: string
  percentage: number
}

export interface MonthlyTrend {
  month: string
  income: number
  expenses: number
}

export interface FinanceDashboard {
  monthly_income: number
  monthly_expenses: number
  net: number
  accounts_total: number
  by_category: CategorySummary[]
  monthly_trend: MonthlyTrend[]
}

// ── Analysis ─────────────────────────────────────────────
export interface Asset {
  ticker: string
  name: string
  type: AssetType
  exchange: string
}

export interface OHLCV {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TechnicalIndicator {
  name: string
  value: string
  signal: "BUY" | "SELL" | "NEUTRAL"
  description: string
}

export interface FixedIncomeProduct {
  id: string
  type: string
  issuer: string
  rate: string
  maturity: string
  min_investment: number
  rating: string | null
  liquidity: "daily" | "on_maturity"
}

// ── Settings ─────────────────────────────────────────────
export interface UserSettings {
  profile: { full_name: string; email: string }
  appearance: { theme: "dark" | "light"; accent_color: string; font_scale: number }
  api_keys: { brapi_token: string; alpha_vantage_key: string }
  llm: { provider: "claude" | "openai" | "gemini"; api_key: string; temperature: number }
}
