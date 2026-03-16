import type {
  Position, PortfolioSummary, RebalanceSuggestion,
  FinancialTransaction, FinanceDashboard,
  Asset, OHLCV, TechnicalIndicator, FixedIncomeProduct,
  UserSettings,
} from "@/types"

// ── Portfolio ────────────────────────────────────────────
export const MOCK_POSITIONS: Position[] = [
  { id: "1", ticker: "PETR4", name: "Petrobras PN", asset_type: "stock", quantity: 200, avg_cost: 28.50, current_price: 35.20, current_value: 7040, total_invested: 5700, pnl: 1340, pnl_pct: 23.51, portfolio_weight: 13.4 },
  { id: "2", ticker: "VALE3", name: "Vale ON", asset_type: "stock", quantity: 100, avg_cost: 62.00, current_price: 58.40, current_value: 5840, total_invested: 6200, pnl: -360, pnl_pct: -5.81, portfolio_weight: 11.1 },
  { id: "3", ticker: "ITUB4", name: "Itáu Unibanco PN", asset_type: "stock", quantity: 300, avg_cost: 22.80, current_price: 26.15, current_value: 7845, total_invested: 6840, pnl: 1005, pnl_pct: 14.69, portfolio_weight: 14.9 },
  { id: "4", ticker: "WEGE3", name: "WEG ON", asset_type: "stock", quantity: 80, avg_cost: 38.20, current_price: 42.60, current_value: 3408, total_invested: 3056, pnl: 352, pnl_pct: 11.52, portfolio_weight: 6.5 },
  { id: "5", ticker: "BBDC4", name: "Bradesco PN", asset_type: "stock", quantity: 400, avg_cost: 16.50, current_price: 15.30, current_value: 6120, total_invested: 6600, pnl: -480, pnl_pct: -7.27, portfolio_weight: 11.6 },
  { id: "6", ticker: "KNRI11", name: "Kinea Renda Imobiliária", asset_type: "reit", quantity: 50, avg_cost: 130.00, current_price: 128.50, current_value: 6425, total_invested: 6500, pnl: -75, pnl_pct: -1.15, portfolio_weight: 12.2 },
  { id: "7", ticker: "AAPL", name: "Apple Inc.", asset_type: "stock", quantity: 10, avg_cost: 170.00, current_price: 185.20, current_value: 1852, total_invested: 1700, pnl: 152, pnl_pct: 8.94, portfolio_weight: 3.5 },
  { id: "8", ticker: "BTC-USD", name: "Bitcoin", asset_type: "crypto", quantity: 0.15, avg_cost: 42000, current_price: 65800, current_value: 9870, total_invested: 6300, pnl: 3570, pnl_pct: 56.67, portfolio_weight: 18.8 },
  { id: "9", ticker: "ETH-USD", name: "Ethereum", asset_type: "crypto", quantity: 1.2, avg_cost: 2800, current_price: 3500, current_value: 4200, total_invested: 3360, pnl: 840, pnl_pct: 25.00, portfolio_weight: 8.0 },
]

export const MOCK_PORTFOLIO_SUMMARY: PortfolioSummary = {
  total_value: 52600,
  total_invested: 46256,
  total_pnl: 6344,
  total_pnl_pct: 13.71,
  day_change: 834,
  day_change_pct: 1.61,
  positions_count: 9,
}

export const MOCK_REBALANCE: RebalanceSuggestion[] = [
  { ticker: "PETR4", name: "Petrobras PN", current_weight: 13.4, target_weight: 10.0, diff: 3.4, action: "sell", quantity: 19, value: 668.8 },
  { ticker: "VALE3", name: "Vale ON", current_weight: 11.1, target_weight: 12.0, diff: -0.9, action: "buy", quantity: 8, value: 467.2 },
  { ticker: "ITUB4", name: "Itáu Unibanco PN", current_weight: 14.9, target_weight: 15.0, diff: -0.1, action: "hold", quantity: 0, value: 0 },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária", current_weight: 12.2, target_weight: 15.0, diff: -2.8, action: "buy", quantity: 11, value: 1413.5 },
  { ticker: "BTC-USD", name: "Bitcoin", current_weight: 18.8, target_weight: 15.0, diff: -3.8, action: "sell", quantity: 0.03, value: 1974.0 },
]

// ── Finance ──────────────────────────────────────────────
export const MOCK_TRANSACTIONS: FinancialTransaction[] = [
  { id: "t1",  date: "2026-03-07", description: "Supermercado Extra",    amount: 287.50, type: "expense", category_name: "Alimentação", category_color: "#f59e0b", account: "Nubank" },
  { id: "t2",  date: "2026-03-06", description: "Uber",                  amount: 32.80,  type: "expense", category_name: "Transporte",  category_color: "#3b82f6", account: "Nubank" },
  { id: "t3",  date: "2026-03-05", description: "Aluguel",               amount: 1850.00,type: "expense", category_name: "Moradia",     category_color: "#8b5cf6", account: "Bradesco" },
  { id: "t4",  date: "2026-03-04", description: "Farmácia",              amount: 89.90,  type: "expense", category_name: "Saúde",       category_color: "#10b981", account: "Nubank" },
  { id: "t5",  date: "2026-03-03", description: "Netflix",               amount: 39.90,  type: "expense", category_name: "Lazer",       category_color: "#f97316", account: "Nubank" },
  { id: "t6",  date: "2026-03-01", description: "Salário",               amount: 8500.00,type: "income",  category_name: "Receita",     category_color: "#22c55e", account: "Bradesco" },
  { id: "t7",  date: "2026-03-01", description: "Restaurante Sushi",     amount: 124.00, type: "expense", category_name: "Alimentação", category_color: "#f59e0b", account: "Nubank" },
  { id: "t8",  date: "2026-02-28", description: "Posto Ipiranga",        amount: 180.00, type: "expense", category_name: "Transporte",  category_color: "#3b82f6", account: "Bradesco" },
  { id: "t9",  date: "2026-02-25", description: "Udemy",                 amount: 29.90,  type: "expense", category_name: "Educação",    category_color: "#06b6d4", account: "Nubank" },
  { id: "t10", date: "2026-02-24", description: "Academia",              amount: 99.00,  type: "expense", category_name: "Saúde",       category_color: "#10b981", account: "Nubank" },
  { id: "t11", date: "2026-02-20", description: "iFood",                 amount: 52.40,  type: "expense", category_name: "Alimentação", category_color: "#f59e0b", account: "Nubank" },
  { id: "t12", date: "2026-02-15", description: "Show de Rock",          amount: 220.00, type: "expense", category_name: "Lazer",       category_color: "#f97316", account: "Nubank" },
  { id: "t13", date: "2026-02-01", description: "Salário",               amount: 8500.00,type: "income",  category_name: "Receita",     category_color: "#22c55e", account: "Bradesco" },
  { id: "t14", date: "2026-02-01", description: "Freelance Dev",         amount: 1200.00,type: "income",  category_name: "Receita",     category_color: "#22c55e", account: "Nubank" },
  { id: "t15", date: "2026-01-28", description: "Mercado",               amount: 315.60, type: "expense", category_name: "Alimentação", category_color: "#f59e0b", account: "Bradesco" },
  { id: "t16", date: "2026-01-20", description: "Plano de Saúde",        amount: 380.00, type: "expense", category_name: "Saúde",       category_color: "#10b981", account: "Bradesco" },
  { id: "t17", date: "2026-01-15", description: "Cinema",                amount: 68.00,  type: "expense", category_name: "Lazer",       category_color: "#f97316", account: "Nubank" },
  { id: "t18", date: "2026-01-10", description: "Uber",                  amount: 45.00,  type: "expense", category_name: "Transporte",  category_color: "#3b82f6", account: "Nubank" },
  { id: "t19", date: "2026-01-01", description: "Salário",               amount: 8500.00,type: "income",  category_name: "Receita",     category_color: "#22c55e", account: "Bradesco" },
  { id: "t20", date: "2026-01-01", description: "Aluguel",               amount: 1850.00,type: "expense", category_name: "Moradia",     category_color: "#8b5cf6", account: "Bradesco" },
]

export const MOCK_FINANCE_DASHBOARD: FinanceDashboard = {
  monthly_income: 8500,
  monthly_expenses: 2723.50,
  net: 5776.50,
  accounts_total: 24850,
  by_category: [
    { name: "Moradia",     amount: 1850.00, color: "#8b5cf6", percentage: 67.9 },
    { name: "Alimentação", amount: 463.90,  color: "#f59e0b", percentage: 17.0 },
    { name: "Saúde",       amount: 89.90,   color: "#10b981", percentage: 3.3 },
    { name: "Lazer",       amount: 39.90,   color: "#f97316", percentage: 1.5 },
    { name: "Transporte",  amount: 32.80,   color: "#3b82f6", percentage: 1.2 },
    { name: "Educação",    amount: 29.90,   color: "#06b6d4", percentage: 1.1 },
  ],
  monthly_trend: [
    { month: "Out", income: 8500, expenses: 3200 },
    { month: "Nov", income: 8500, expenses: 2980 },
    { month: "Dez", income: 9200, expenses: 4100 },
    { month: "Jan", income: 8500, expenses: 3050 },
    { month: "Fev", income: 9700, expenses: 3380 },
    { month: "Mar", income: 8500, expenses: 2723 },
  ],
}

// ── Analysis ─────────────────────────────────────────────
export const MOCK_ASSETS: Asset[] = [
  { ticker: "PETR4",   name: "Petrobras PN",          type: "stock",  exchange: "BOVESPA" },
  { ticker: "VALE3",   name: "Vale ON",                type: "stock",  exchange: "BOVESPA" },
  { ticker: "ITUB4",   name: "Itáu Unibanco PN",       type: "stock",  exchange: "BOVESPA" },
  { ticker: "WEGE3",   name: "WEG ON",                 type: "stock",  exchange: "BOVESPA" },
  { ticker: "BBDC4",   name: "Bradesco PN",            type: "stock",  exchange: "BOVESPA" },
  { ticker: "BOVA11",  name: "iShares Ibovespa ETF",   type: "etf",    exchange: "BOVESPA" },
  { ticker: "AAPL",    name: "Apple Inc.",              type: "stock",  exchange: "NASDAQ" },
  { ticker: "MSFT",    name: "Microsoft Corp.",         type: "stock",  exchange: "NASDAQ" },
  { ticker: "BTC-USD", name: "Bitcoin",                type: "crypto", exchange: "CRYPTO" },
  { ticker: "ETH-USD", name: "Ethereum",               type: "crypto", exchange: "CRYPTO" },
]

function generateOHLCV(days: number, startPrice: number): OHLCV[] {
  const data: OHLCV[] = []
  let price = startPrice
  const today = new Date(2026, 2, 8)
  for (let i = days; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const change = (Math.random() - 0.48) * price * 0.025
    const open = price
    price = Math.max(price + change, 1)
    const high = Math.max(open, price) * (1 + Math.random() * 0.01)
    const low  = Math.min(open, price) * (1 - Math.random() * 0.01)
    data.push({
      date:   d.toISOString().split("T")[0],
      open:   +open.toFixed(2),
      high:   +high.toFixed(2),
      low:    +low.toFixed(2),
      close:  +price.toFixed(2),
      volume: Math.floor(Math.random() * 5_000_000 + 1_000_000),
    })
  }
  return data
}

const MOCK_OHLCV_MAP: Record<string, OHLCV[]> = {
  PETR4:     generateOHLCV(90, 28.0),
  VALE3:     generateOHLCV(90, 65.0),
  AAPL:      generateOHLCV(90, 175.0),
  "BTC-USD": generateOHLCV(90, 42000),
}

export function getMockOHLCV(ticker: string): OHLCV[] {
  return MOCK_OHLCV_MAP[ticker] ?? MOCK_OHLCV_MAP["PETR4"]
}

export const MOCK_INDICATORS: TechnicalIndicator[] = [
  { name: "RSI (14)",       value: "62.4",   signal: "NEUTRAL", description: "Momentum oscillator 0-100" },
  { name: "MACD",           value: "0.85",   signal: "BUY",     description: "Trend following" },
  { name: "Sinal MACD",     value: "0.42",   signal: "BUY",     description: "EMA 9 do MACD" },
  { name: "SMA 20",         value: "34.15",  signal: "BUY",     description: "Preço acima da SMA 20" },
  { name: "SMA 50",         value: "31.80",  signal: "BUY",     description: "Preço acima da SMA 50" },
  { name: "SMA 200",        value: "29.40",  signal: "BUY",     description: "Preço acima da SMA 200" },
  { name: "Bollinger Sup.", value: "37.90",  signal: "NEUTRAL", description: "Banda superior" },
  { name: "Bollinger Inf.", value: "30.40",  signal: "NEUTRAL", description: "Banda inferior" },
]

export const MOCK_FIXED_INCOME: FixedIncomeProduct[] = [
  { id: "fi1", type: "Tesouro SELIC",      issuer: "Governo Federal", rate: "SELIC + 0.0589%",   maturity: "01/03/2029",      min_investment: 100,   rating: "AAA",  liquidity: "daily" },
  { id: "fi2", type: "Tesouro IPCA+",      issuer: "Governo Federal", rate: "IPCA + 6.12% a.a.", maturity: "15/08/2035",      min_investment: 50,    rating: "AAA",  liquidity: "on_maturity" },
  { id: "fi3", type: "Tesouro Prefixado",  issuer: "Governo Federal", rate: "13.55% a.a.",        maturity: "01/01/2028",      min_investment: 35,    rating: "AAA",  liquidity: "on_maturity" },
  { id: "fi4", type: "CDB",               issuer: "Banco Inter",     rate: "115% CDI",           maturity: "10/03/2027",      min_investment: 1000,  rating: "A+",   liquidity: "on_maturity" },
  { id: "fi5", type: "CDB",               issuer: "Nubank",          rate: "100% CDI",           maturity: "Sem vencimento",  min_investment: 1,     rating: "AA-",  liquidity: "daily" },
  { id: "fi6", type: "LCI",               issuer: "Banco do Brasil", rate: "92% CDI",            maturity: "15/06/2026",      min_investment: 5000,  rating: "AA+",  liquidity: "on_maturity" },
  { id: "fi7", type: "LCA",               issuer: "Bradesco",        rate: "IPCA + 5.50% a.a.",  maturity: "20/09/2027",      min_investment: 10000, rating: "AA",   liquidity: "on_maturity" },
]

// ── Settings ─────────────────────────────────────────────
export const MOCK_SETTINGS: UserSettings = {
  profile:    { full_name: "João Silva", email: "joao@exemplo.com" },
  appearance: { theme: "dark", accent_color: "#3b82f6", font_scale: 1.0 },
  api_keys:   { brapi_token: "", alpha_vantage_key: "" },
  llm:        { provider: "claude", api_key: "", temperature: 0.7 },
}
