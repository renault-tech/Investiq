# Frontend Dashboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build all 4 InvestIQ platform dashboards (Investimentos, Finanças, Análise, Configurações) with mock data and a dense, professional dark UI.

**Architecture:** Foundation-first — shared types → mock data → TanStack Query hooks → shared UI components → 4 area dashboards. All data via mock queryFns; to go live, swap queryFn in each hook.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Recharts, TanStack Query v5, Zustand v5, lucide-react

---

## Phase 0 — Dependencies

### Task 1: Install recharts and @tanstack/react-query

**Files:**
- Modify: `apps/web/package.json` (via workspace flag)

**Step 1: Install**

Run from `C:\Dev\investiq`:
```bash
npm install recharts @tanstack/react-query --workspace=@investiq/web
```
Expected: `added N packages, audited N packages in Xs`

**Step 2: Verify**
```bash
node -e "require('C:/Dev/investiq/node_modules/recharts'); require('C:/Dev/investiq/node_modules/@tanstack/react-query'); console.log('ok')"
```
Expected: `ok`

**Step 3: Commit**
```bash
cd C:\Dev\investiq
git add package.json package-lock.json apps/web/package.json
git commit -m "chore: install recharts and @tanstack/react-query"
```

---

## Phase 1 — Foundation

### Task 2: TypeScript Types

**Files:**
- Create: `apps/web/src/types/index.ts`

**Step 1: Create file with full content**

```typescript
// apps/web/src/types/index.ts

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
```

**Step 2: Verify TypeScript**
```bash
cd C:\Dev\investiq\apps\web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output (no errors)

**Step 3: Commit**
```bash
cd C:\Dev\investiq
git add apps/web/src/types/index.ts
git commit -m "feat: add shared TypeScript types for all domains"
```

---

### Task 3: Mock Data

**Files:**
- Create: `apps/web/src/lib/mock-data.ts`

**Step 1: Create file**

```typescript
// apps/web/src/lib/mock-data.ts
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
  { id: "3", ticker: "ITUB4", name: "Itaú Unibanco PN", asset_type: "stock", quantity: 300, avg_cost: 22.80, current_price: 26.15, current_value: 7845, total_invested: 6840, pnl: 1005, pnl_pct: 14.69, portfolio_weight: 14.9 },
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
  { ticker: "ITUB4", name: "Itaú Unibanco PN", current_weight: 14.9, target_weight: 15.0, diff: -0.1, action: "hold", quantity: 0, value: 0 },
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
  { ticker: "ITUB4",   name: "Itaú Unibanco PN",       type: "stock",  exchange: "BOVESPA" },
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
  PETR4:   generateOHLCV(90, 28.0),
  VALE3:   generateOHLCV(90, 65.0),
  AAPL:    generateOHLCV(90, 175.0),
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
  { id: "fi1", type: "Tesouro SELIC",      issuer: "Governo Federal", rate: "SELIC + 0.0589%",  maturity: "01/03/2029",     min_investment: 100,   rating: "AAA",  liquidity: "daily" },
  { id: "fi2", type: "Tesouro IPCA+",      issuer: "Governo Federal", rate: "IPCA + 6.12% a.a.", maturity: "15/08/2035",    min_investment: 50,    rating: "AAA",  liquidity: "on_maturity" },
  { id: "fi3", type: "Tesouro Prefixado",  issuer: "Governo Federal", rate: "13.55% a.a.",       maturity: "01/01/2028",    min_investment: 35,    rating: "AAA",  liquidity: "on_maturity" },
  { id: "fi4", type: "CDB",               issuer: "Banco Inter",     rate: "115% CDI",          maturity: "10/03/2027",    min_investment: 1000,  rating: "A+",   liquidity: "on_maturity" },
  { id: "fi5", type: "CDB",               issuer: "Nubank",          rate: "100% CDI",          maturity: "Sem vencimento", min_investment: 1,    rating: "AA-",  liquidity: "daily" },
  { id: "fi6", type: "LCI",               issuer: "Banco do Brasil", rate: "92% CDI",           maturity: "15/06/2026",    min_investment: 5000,  rating: "AA+",  liquidity: "on_maturity" },
  { id: "fi7", type: "LCA",               issuer: "Bradesco",        rate: "IPCA + 5.50% a.a.", maturity: "20/09/2027",    min_investment: 10000, rating: "AA",   liquidity: "on_maturity" },
]

// ── Settings ─────────────────────────────────────────────
export const MOCK_SETTINGS: UserSettings = {
  profile:    { full_name: "João Silva", email: "joao@exemplo.com" },
  appearance: { theme: "dark", accent_color: "#3b82f6", font_scale: 1.0 },
  api_keys:   { brapi_token: "", alpha_vantage_key: "" },
  llm:        { provider: "claude", api_key: "", temperature: 0.7 },
}
```

**Step 2: Commit**
```bash
cd C:\Dev\investiq
git add apps/web/src/lib/mock-data.ts
git commit -m "feat: add mock data for all domains (portfolio, finance, analysis, settings)"
```

---

### Task 4: TanStack Query Provider

**Files:**
- Create: `apps/web/src/lib/query-client.ts`
- Create: `apps/web/src/lib/QueryProvider.tsx`
- Modify: `apps/web/src/app/(platform)/layout.tsx`

**Step 1: Create query-client.ts**

```typescript
// apps/web/src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime:    300_000,
      retry: 1,
    },
  },
})
```

**Step 2: Create QueryProvider.tsx**

```tsx
// apps/web/src/lib/QueryProvider.tsx
"use client"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "./query-client"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

**Step 3: Read and update platform layout**

Read `apps/web/src/app/(platform)/layout.tsx` first, then wrap with QueryProvider:

```tsx
// apps/web/src/app/(platform)/layout.tsx
import { PlatformShell } from "@/components/layout/PlatformShell"
import { QueryProvider } from "@/lib/QueryProvider"

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <PlatformShell>{children}</PlatformShell>
    </QueryProvider>
  )
}
```

**Step 4: Commit**
```bash
cd C:\Dev\investiq
git add apps/web/src/lib/query-client.ts apps/web/src/lib/QueryProvider.tsx apps/web/src/app/(platform)/layout.tsx
git commit -m "feat: add TanStack Query client and provider to platform layout"
```

---

### Task 5: Data Hooks

**Files:**
- Create: `apps/web/src/lib/hooks/usePortfolio.ts`
- Create: `apps/web/src/lib/hooks/useFinance.ts`
- Create: `apps/web/src/lib/hooks/useAnalysis.ts`
- Create: `apps/web/src/lib/hooks/useSettings.ts`

**Step 1: Create usePortfolio.ts**

```typescript
// apps/web/src/lib/hooks/usePortfolio.ts
import { useQuery } from "@tanstack/react-query"
import { MOCK_PORTFOLIO_SUMMARY, MOCK_POSITIONS, MOCK_REBALANCE } from "@/lib/mock-data"

export const usePortfolioSummary = () =>
  useQuery({ queryKey: ["portfolio", "summary"], queryFn: () => Promise.resolve(MOCK_PORTFOLIO_SUMMARY) })

export const usePositions = () =>
  useQuery({ queryKey: ["portfolio", "positions"], queryFn: () => Promise.resolve(MOCK_POSITIONS) })

export const useRebalance = () =>
  useQuery({ queryKey: ["portfolio", "rebalance"], queryFn: () => Promise.resolve(MOCK_REBALANCE) })
```

**Step 2: Create useFinance.ts**

```typescript
// apps/web/src/lib/hooks/useFinance.ts
import { useQuery } from "@tanstack/react-query"
import { MOCK_FINANCE_DASHBOARD, MOCK_TRANSACTIONS } from "@/lib/mock-data"
import type { FinancialTransaction } from "@/types"

interface TransactionFilters { month?: string; category?: string }

export const useFinanceDashboard = () =>
  useQuery({ queryKey: ["finance", "dashboard"], queryFn: () => Promise.resolve(MOCK_FINANCE_DASHBOARD) })

export const useTransactions = (filters?: TransactionFilters) =>
  useQuery({
    queryKey: ["finance", "transactions", filters],
    queryFn: () => {
      let data: FinancialTransaction[] = MOCK_TRANSACTIONS
      if (filters?.category) data = data.filter(t => t.category_name === filters.category)
      if (filters?.month)    data = data.filter(t => t.date.startsWith(filters.month!))
      return Promise.resolve(data)
    },
  })
```

**Step 3: Create useAnalysis.ts**

```typescript
// apps/web/src/lib/hooks/useAnalysis.ts
import { useQuery } from "@tanstack/react-query"
import { MOCK_ASSETS, getMockOHLCV, MOCK_INDICATORS, MOCK_FIXED_INCOME } from "@/lib/mock-data"

export const useAssets = (query: string) =>
  useQuery({
    queryKey: ["analysis", "assets", query],
    queryFn: () => {
      const q = query.toLowerCase()
      return Promise.resolve(
        q.length < 1 ? [] : MOCK_ASSETS.filter(a =>
          a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
        )
      )
    },
  })

export const useOHLCV = (ticker: string, _range: string) =>
  useQuery({
    queryKey: ["analysis", "ohlcv", ticker],
    queryFn: () => Promise.resolve(getMockOHLCV(ticker)),
    enabled: !!ticker,
  })

export const useIndicators = (_ticker: string) =>
  useQuery({ queryKey: ["analysis", "indicators"], queryFn: () => Promise.resolve(MOCK_INDICATORS) })

export const useFixedIncome = () =>
  useQuery({ queryKey: ["analysis", "fixedIncome"], queryFn: () => Promise.resolve(MOCK_FIXED_INCOME) })
```

**Step 4: Create useSettings.ts**

```typescript
// apps/web/src/lib/hooks/useSettings.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { MOCK_SETTINGS } from "@/lib/mock-data"
import type { UserSettings } from "@/types"

// In-memory store for mock mutations
let settingsStore: UserSettings = { ...MOCK_SETTINGS }

export const useSettings = () =>
  useQuery({ queryKey: ["settings"], queryFn: () => Promise.resolve(settingsStore) })

export const useSaveSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) => {
      settingsStore = { ...settingsStore, ...patch }
      return Promise.resolve(settingsStore)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  })
}
```

**Step 5: Commit**
```bash
cd C:\Dev\investiq
git add apps/web/src/lib/hooks/
git commit -m "feat: add TanStack Query hooks for all domains (mock data)"
```

---

### Task 6: Shared Components

**Files:**
- Create: `apps/web/src/components/shared/PercentChange.tsx`
- Create: `apps/web/src/components/shared/Badge.tsx`
- Create: `apps/web/src/components/shared/StatCard.tsx`
- Create: `apps/web/src/components/shared/DataTable.tsx`
- Create: `apps/web/src/components/shared/LoadingSkeleton.tsx`
- Create: `apps/web/src/components/shared/EmptyState.tsx`

**Step 1: PercentChange.tsx**

```tsx
// apps/web/src/components/shared/PercentChange.tsx
"use client"

interface Props { value: number; label?: string }

export function PercentChange({ value, label }: Props) {
  const pos = value >= 0
  return (
    <span className={`text-xs font-medium ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? "+" : ""}{value.toFixed(2)}%
      {label && <span className="text-neutral-500 ml-1">{label}</span>}
    </span>
  )
}
```

**Step 2: Badge.tsx**

```tsx
// apps/web/src/components/shared/Badge.tsx
"use client"

const COLORS: Record<string, string> = {
  blue:    "bg-blue-900/50 text-blue-300 border-blue-800",
  green:   "bg-emerald-900/50 text-emerald-300 border-emerald-800",
  red:     "bg-red-900/50 text-red-300 border-red-800",
  yellow:  "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  purple:  "bg-purple-900/50 text-purple-300 border-purple-800",
  orange:  "bg-orange-900/50 text-orange-300 border-orange-800",
  cyan:    "bg-cyan-900/50 text-cyan-300 border-cyan-800",
  neutral: "bg-neutral-800 text-neutral-300 border-neutral-700",
}

interface BadgeProps { label: string; color?: keyof typeof COLORS }

export function Badge({ label, color = "neutral" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${COLORS[color] ?? COLORS.neutral}`}>
      {label}
    </span>
  )
}
```

**Step 3: StatCard.tsx**

```tsx
// apps/web/src/components/shared/StatCard.tsx
"use client"
import type { ReactNode } from "react"
import { PercentChange } from "./PercentChange"

interface StatCardProps {
  label: string
  value: string
  change?: number
  changeLabel?: string
  icon?: ReactNode
  valueColor?: string
}

export function StatCard({ label, value, change, changeLabel, icon, valueColor }: StatCardProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-500 uppercase tracking-widest">{label}</span>
        {icon && <span className="text-neutral-600">{icon}</span>}
      </div>
      <span className={`text-xl font-semibold tabular-nums ${valueColor ?? "text-neutral-100"}`}>
        {value}
      </span>
      {change !== undefined && (
        <PercentChange value={change} label={changeLabel} />
      )}
    </div>
  )
}
```

**Step 4: DataTable.tsx**

```tsx
// apps/web/src/components/shared/DataTable.tsx
"use client"
import type { ReactNode } from "react"

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  align?: "left" | "right" | "center"
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  keyField?: keyof T
}

export function DataTable<T>({ columns, data, onRowClick, emptyMessage = "Nenhum dado", keyField }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-800">
            {columns.map(col => (
              <th
                key={col.key}
                className={`py-2 px-3 text-neutral-400 font-medium whitespace-nowrap text-${col.align ?? "left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-neutral-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={keyField ? String(row[keyField]) : i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-neutral-800/40 hover:bg-neutral-800/40 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`py-2 px-3 text-neutral-200 whitespace-nowrap text-${col.align ?? "left"}`}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 5: LoadingSkeleton.tsx**

```tsx
// apps/web/src/components/shared/LoadingSkeleton.tsx
"use client"

interface Props { variant?: "card" | "table" | "chart" | "row" }

export function LoadingSkeleton({ variant = "card" }: Props) {
  if (variant === "card") {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-2 animate-pulse">
        <div className="h-2 w-20 bg-neutral-800 rounded" />
        <div className="h-6 w-32 bg-neutral-800 rounded" />
        <div className="h-2 w-14 bg-neutral-800 rounded" />
      </div>
    )
  }
  if (variant === "table") {
    return (
      <div className="flex flex-col gap-2 animate-pulse p-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-neutral-800/60 rounded" />
        ))}
      </div>
    )
  }
  if (variant === "chart") {
    return <div className="bg-neutral-800/60 rounded animate-pulse" style={{ height: "200px" }} />
  }
  return <div className="h-8 bg-neutral-800/60 rounded animate-pulse" />
}
```

**Step 6: EmptyState.tsx**

```tsx
// apps/web/src/components/shared/EmptyState.tsx
"use client"
import type { ReactNode } from "react"

interface Props { message: string; icon?: ReactNode }

export function EmptyState({ message, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-neutral-500">
      {icon && <div className="text-4xl">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  )
}
```

**Step 7: Verify TypeScript**
```bash
cd C:\Dev\investiq\apps\web && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output

**Step 8: Commit**
```bash
cd C:\Dev\investiq
git add apps/web/src/components/shared/
git commit -m "feat: add shared UI components (StatCard, DataTable, Badge, PercentChange, Skeleton, EmptyState)"
```

---

## Phase 2 — Área Investimentos

### Task 7: PortfolioSummaryCards

**Files:**
- Create: `apps/web/src/app/(platform)/investments/PortfolioSummaryCards.tsx`

```tsx
"use client"
import { usePortfolioSummary } from "@/lib/hooks/usePortfolio"
import { StatCard } from "@/components/shared/StatCard"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

export function PortfolioSummaryCards() {
  const { data, isLoading } = usePortfolioSummary()

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <LoadingSkeleton key={i} variant="card" />)}
    </div>
  )
  if (!data) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Patrimônio Total"  value={brl(data.total_value)} />
      <StatCard label="P&L Total"         value={brl(data.total_pnl)}   change={data.total_pnl_pct} />
      <StatCard label="Variação Hoje"     value={brl(data.day_change)}  change={data.day_change_pct} />
      <StatCard label="Posições"          value={String(data.positions_count)} />
    </div>
  )
}
```

### Task 8: PositionsTable

**Files:**
- Create: `apps/web/src/app/(platform)/investments/PositionsTable.tsx`

```tsx
"use client"
import { usePositions } from "@/lib/hooks/usePortfolio"
import { DataTable, Column } from "@/components/shared/DataTable"
import { PercentChange } from "@/components/shared/PercentChange"
import { Badge } from "@/components/shared/Badge"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import type { Position } from "@/types"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const fmt = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })

const TYPE_COLOR: Record<string, "blue" | "purple" | "orange" | "green" | "neutral"> = {
  stock: "blue", reit: "purple", crypto: "orange", etf: "green", bond: "neutral",
}

const COLUMNS: Column<Position>[] = [
  { key: "ticker",           header: "Ticker",    render: r => <span className="font-mono font-bold text-neutral-100">{r.ticker}</span> },
  { key: "name",             header: "Nome" },
  { key: "asset_type",       header: "Tipo",      render: r => <Badge label={r.asset_type.toUpperCase()} color={TYPE_COLOR[r.asset_type]} /> },
  { key: "quantity",         header: "Qtd",       align: "right", render: r => fmt(r.quantity, r.asset_type === "crypto" ? 4 : 0) },
  { key: "avg_cost",         header: "P. Médio",  align: "right", render: r => brl(r.avg_cost) },
  { key: "current_price",    header: "P. Atual",  align: "right", render: r => brl(r.current_price) },
  { key: "current_value",    header: "Valor",     align: "right", render: r => brl(r.current_value) },
  { key: "pnl",              header: "P&L",       align: "right", render: r => <span className={r.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>{brl(r.pnl)}</span> },
  { key: "pnl_pct",          header: "P&L %",     align: "right", render: r => <PercentChange value={r.pnl_pct} /> },
  { key: "portfolio_weight", header: "% Cart.",   align: "right", render: r => `${r.portfolio_weight.toFixed(1)}%` },
]

export function PositionsTable() {
  const { data = [], isLoading } = usePositions()

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Posições</h2>
        <span className="text-xs text-neutral-500">{data.length} ativos</span>
      </div>
      {isLoading ? <LoadingSkeleton variant="table" /> : <DataTable<Position> columns={COLUMNS} data={data} keyField="id" />}
    </div>
  )
}
```

### Task 9: AllocationChart

**Files:**
- Create: `apps/web/src/app/(platform)/investments/AllocationChart.tsx`

```tsx
"use client"
import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { usePositions } from "@/lib/hooks/usePortfolio"
import type { Position } from "@/types"

const PALETTE = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#f97316","#06b6d4","#ec4899","#14b8a6","#84cc16"]

type GroupBy = "asset" | "type"

function group(positions: Position[], by: GroupBy) {
  const map = new Map<string, number>()
  for (const p of positions) {
    const key = by === "asset" ? p.ticker : p.asset_type
    map.set(key, (map.get(key) ?? 0) + p.portfolio_weight)
  }
  return Array.from(map.entries()).map(([name, value], i) => ({
    name, value: +value.toFixed(1), fill: PALETTE[i % PALETTE.length],
  }))
}

export function AllocationChart() {
  const { data: positions = [] } = usePositions()
  const [groupBy, setGroupBy] = useState<GroupBy>("asset")
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const chartData = group(positions, groupBy)

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Alocação</h2>
        <div className="flex gap-1">
          {(["asset","type"] as GroupBy[]).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${groupBy === g ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>
              {g === "asset" ? "Ativo" : "Tipo"}
            </button>
          ))}
        </div>
      </div>
      {mounted ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
              {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Pie>
            <Tooltip
              formatter={(v: number) => [`${v}%`, ""]}
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: "6px", fontSize: "11px" }}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] bg-neutral-800/50 animate-pulse rounded" />
      )}
    </div>
  )
}
```

### Task 10: RebalancePanel

**Files:**
- Create: `apps/web/src/app/(platform)/investments/RebalancePanel.tsx`

```tsx
"use client"
import { useRebalance } from "@/lib/hooks/usePortfolio"
import { PercentChange } from "@/components/shared/PercentChange"
import { Badge } from "@/components/shared/Badge"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const ACTION_COLOR = { buy: "green", sell: "red", hold: "neutral" } as const

export function RebalancePanel() {
  const { data = [] } = useRebalance()

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Rebalanceamento</h2>
        <button
          onClick={() => alert("Funcionalidade em breve")}
          className="px-3 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Executar
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="py-2 px-3 text-neutral-400 font-medium text-left">Ativo</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Atual%</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Alvo%</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Dif.</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-center">Ação</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Sugestão</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.ticker} className="border-b border-neutral-800/40 hover:bg-neutral-800/40">
                <td className="py-2 px-3 font-mono font-semibold text-neutral-100">{r.ticker}</td>
                <td className="py-2 px-3 text-right text-neutral-300">{r.current_weight.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right text-neutral-300">{r.target_weight.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right"><PercentChange value={r.diff} /></td>
                <td className="py-2 px-3 text-center">
                  <Badge label={r.action.toUpperCase()} color={ACTION_COLOR[r.action]} />
                </td>
                <td className="py-2 px-3 text-right text-neutral-400 text-[10px]">
                  {r.action !== "hold"
                    ? `${r.action === "buy" ? "Comprar" : "Vender"} ${r.quantity} un. (${brl(r.value)})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### Task 11: Investments Page Assembly

**Files:**
- Modify: `apps/web/src/app/(platform)/investments/page.tsx`

```tsx
// apps/web/src/app/(platform)/investments/page.tsx
import { PortfolioSummaryCards } from "./PortfolioSummaryCards"
import { PositionsTable }        from "./PositionsTable"
import { AllocationChart }       from "./AllocationChart"
import { RebalancePanel }        from "./RebalancePanel"

export default function InvestmentsPage() {
  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-4">
      <PortfolioSummaryCards />
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <PositionsTable />
        </div>
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <AllocationChart />
          <RebalancePanel />
        </div>
      </div>
    </div>
  )
}
```

**Verification:** After saving all files:
- Start server: `preview_start name: "web"`
- Navigate to `/investments`
- Take screenshot and confirm: 4 stat cards, positions table with 9 rows, allocation donut, rebalance table

**Commit:**
```bash
cd C:\Dev\investiq
git add apps/web/src/app/(platform)/investments/
git commit -m "feat: implement Investments dashboard (positions, allocation chart, rebalance panel)"
```

---

## Phase 3 — Área Finanças

### Task 12: FinanceSummaryCards + TransactionsTable

**Files:**
- Create: `apps/web/src/app/(platform)/finances/FinanceSummaryCards.tsx`
- Create: `apps/web/src/app/(platform)/finances/TransactionsTable.tsx`

**FinanceSummaryCards.tsx:**
```tsx
"use client"
import { useFinanceDashboard } from "@/lib/hooks/useFinance"
import { StatCard } from "@/components/shared/StatCard"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

export function FinanceSummaryCards() {
  const { data, isLoading } = useFinanceDashboard()

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <LoadingSkeleton key={i} variant="card" />)}
    </div>
  )
  if (!data) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Receita Mês"    value={brl(data.monthly_income)}   valueColor="text-emerald-400" />
      <StatCard label="Despesas Mês"   value={brl(data.monthly_expenses)} valueColor="text-red-400" />
      <StatCard label="Saldo Líquido"  value={brl(data.net)}              valueColor={data.net >= 0 ? "text-emerald-400" : "text-red-400"} />
      <StatCard label="Total Contas"   value={brl(data.accounts_total)} />
    </div>
  )
}
```

**TransactionsTable.tsx:**
```tsx
"use client"
import { useState } from "react"
import { useTransactions } from "@/lib/hooks/useFinance"
import { DataTable, Column } from "@/components/shared/DataTable"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import type { FinancialTransaction } from "@/types"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const COLUMNS: Column<FinancialTransaction>[] = [
  { key: "date",          header: "Data",       render: r => r.date.split("-").reverse().join("/") },
  { key: "description",   header: "Descrição" },
  { key: "category_name", header: "Categoria",  render: r => (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.category_color }} />
      {r.category_name}
    </span>
  )},
  { key: "account",       header: "Conta" },
  { key: "amount",        header: "Valor",      align: "right",
    render: r => (
      <span className={r.type === "income" ? "text-emerald-400" : "text-red-400"}>
        {r.type === "income" ? "+" : "-"}{brl(r.amount)}
      </span>
    )
  },
]

const MONTHS = [
  { label: "Março 2026",     value: "2026-03" },
  { label: "Fevereiro 2026", value: "2026-02" },
  { label: "Janeiro 2026",   value: "2026-01" },
]

export function TransactionsTable() {
  const [month, setMonth] = useState("2026-03")
  const { data = [], isLoading } = useTransactions({ month })

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-neutral-200">Transações</h2>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs rounded px-2 py-1"
        >
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      {isLoading
        ? <LoadingSkeleton variant="table" />
        : <DataTable<FinancialTransaction> columns={COLUMNS} data={data} keyField="id" emptyMessage="Nenhuma transação no período" />
      }
    </div>
  )
}
```

### Task 13: CategoryDonutChart + MonthlyBarChart

**Files:**
- Create: `apps/web/src/app/(platform)/finances/CategoryDonutChart.tsx`
- Create: `apps/web/src/app/(platform)/finances/MonthlyBarChart.tsx`

**CategoryDonutChart.tsx:**
```tsx
"use client"
import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { useFinanceDashboard } from "@/lib/hooks/useFinance"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

export function CategoryDonutChart() {
  const { data } = useFinanceDashboard()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const chartData = data?.by_category.filter(c => c.amount > 0) ?? []

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-200">Despesas por Categoria</h2>
      {mounted ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={chartData} dataKey="amount" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip
              formatter={(v: number) => [brl(v), ""]}
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: "6px", fontSize: "11px" }}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] bg-neutral-800/50 animate-pulse rounded" />
      )}
    </div>
  )
}
```

**MonthlyBarChart.tsx:**
```tsx
"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts"
import { useFinanceDashboard } from "@/lib/hooks/useFinance"

export function MonthlyBarChart() {
  const { data } = useFinanceDashboard()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-200">Receita vs Despesa (6 meses)</h2>
      {mounted ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data?.monthly_trend ?? []} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} width={50}
              tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: "6px", fontSize: "11px" }}
              formatter={(v: number) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v), ""]}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
            <Bar dataKey="income"   name="Receita"  fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] bg-neutral-800/50 animate-pulse rounded" />
      )}
    </div>
  )
}
```

### Task 14: Finances Page Assembly

**Files:**
- Modify: `apps/web/src/app/(platform)/finances/page.tsx`

```tsx
import { FinanceSummaryCards } from "./FinanceSummaryCards"
import { TransactionsTable }   from "./TransactionsTable"
import { CategoryDonutChart }  from "./CategoryDonutChart"
import { MonthlyBarChart }     from "./MonthlyBarChart"

export default function FinancesPage() {
  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-4">
      <FinanceSummaryCards />
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <TransactionsTable />
        </div>
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <CategoryDonutChart />
          <MonthlyBarChart />
        </div>
      </div>
    </div>
  )
}
```

**Verification:** Navigate to `/finances`, screenshot: 4 stat cards, transactions table with month filter, donut + bar charts.

**Commit:**
```bash
cd C:\Dev\investiq
git add apps/web/src/app/(platform)/finances/
git commit -m "feat: implement Finances dashboard (transactions, category chart, monthly trends)"
```

---

## Phase 4 — Área Análise

### Task 15: AssetSearch

**Files:**
- Create: `apps/web/src/app/(platform)/analysis/AssetSearch.tsx`

```tsx
"use client"
import { useState, useRef, useEffect } from "react"
import { Search } from "lucide-react"
import { useAssets } from "@/lib/hooks/useAnalysis"
import { Badge } from "@/components/shared/Badge"
import type { Asset } from "@/types"

const TYPE_COLOR: Record<string, "blue"|"purple"|"orange"|"green"> = {
  stock: "blue", reit: "purple", crypto: "orange", etf: "green",
}

interface Props { onSelect: (asset: Asset) => void; selected?: string }

export function AssetSearch({ onSelect, selected }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: results = [] } = useAssets(query)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative w-72">
      <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
        <Search size={14} className="text-neutral-500 shrink-0" />
        <input
          className="bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none w-full"
          placeholder="Buscar ativo (ex: PETR4, BTC)..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {selected && <span className="text-xs font-mono text-blue-400 shrink-0">{selected}</span>}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map(asset => (
            <button
              key={asset.ticker}
              onClick={() => { onSelect(asset); setQuery(""); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-800 transition-colors text-left"
            >
              <span className="font-mono text-xs font-bold text-neutral-100 w-16">{asset.ticker}</span>
              <span className="text-xs text-neutral-400 flex-1 truncate">{asset.name}</span>
              <Badge label={asset.type.toUpperCase()} color={TYPE_COLOR[asset.type] ?? "neutral"} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Task 16: PriceChart

**Files:**
- Create: `apps/web/src/app/(platform)/analysis/PriceChart.tsx`

```tsx
"use client"
import { useState, useEffect } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { useOHLCV } from "@/lib/hooks/useAnalysis"
import type { OHLCV } from "@/types"

const RANGES: Record<string, number> = { "1D": 1, "1W": 7, "1M": 30, "1A": 90 }

interface Props { ticker: string }

export function PriceChart({ ticker }: Props) {
  const [range, setRange] = useState("1M")
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data: ohlcv = [] } = useOHLCV(ticker, range)
  const sliced = ohlcv.slice(-RANGES[range])
  const last   = sliced[sliced.length - 1]
  const first  = sliced[0]
  const change = last && first ? ((last.close - first.close) / first.close) * 100 : 0
  const positive = change >= 0

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3 flex-1">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-neutral-100">{ticker}</span>
          {last && (
            <span className="ml-3 text-lg font-semibold tabular-nums text-neutral-100">
              R$ {last.close.toFixed(2)}
            </span>
          )}
          {last && (
            <span className={`ml-2 text-xs font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
              {positive ? "+" : ""}{change.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {Object.keys(RANGES).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${range === r ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      {mounted ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={sliced}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={positive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={positive ? "#10b981" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false}
              tickFormatter={d => d.split("-").slice(1).join("/")} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false} width={55}
              domain={["auto","auto"]} tickFormatter={v => `${v.toFixed(0)}`} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: "6px", fontSize: "11px" }}
              formatter={(v: number) => [v.toFixed(2), "Fechamento"]}
            />
            <Area type="monotone" dataKey="close" stroke={positive ? "#10b981" : "#ef4444"}
              strokeWidth={1.5} fill="url(#priceGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <div className="h-[240px] bg-neutral-800/50 animate-pulse rounded" />}
    </div>
  )
}
```

### Task 17: IndicatorsPanel

**Files:**
- Create: `apps/web/src/app/(platform)/analysis/IndicatorsPanel.tsx`

```tsx
"use client"
import { useIndicators } from "@/lib/hooks/useAnalysis"
import { Badge } from "@/components/shared/Badge"

const SIGNAL_COLOR = { BUY: "green", SELL: "red", NEUTRAL: "neutral" } as const

interface Props { ticker: string }

export function IndicatorsPanel({ ticker }: Props) {
  const { data = [] } = useIndicators(ticker)

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-200">Indicadores Técnicos</h2>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-800">
            <th className="py-2 px-3 text-neutral-400 font-medium text-left">Indicador</th>
            <th className="py-2 px-3 text-neutral-400 font-medium text-right">Valor</th>
            <th className="py-2 px-3 text-neutral-400 font-medium text-center">Sinal</th>
          </tr>
        </thead>
        <tbody>
          {data.map(ind => (
            <tr key={ind.name} className="border-b border-neutral-800/40 hover:bg-neutral-800/40">
              <td className="py-2 px-3 text-neutral-300">{ind.name}</td>
              <td className="py-2 px-3 text-right font-mono text-neutral-200">{ind.value}</td>
              <td className="py-2 px-3 text-center">
                <Badge label={ind.signal} color={SIGNAL_COLOR[ind.signal]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Task 18: AIAnalysisPanel

**Files:**
- Create: `apps/web/src/app/(platform)/analysis/AIAnalysisPanel.tsx`

```tsx
"use client"
import { useState, useRef, useEffect } from "react"
import { Sparkles } from "lucide-react"

const MOCK_ANALYSIS = `Analisando ${"%TICKER%"}...

**Resumo Técnico:**
Com base nos indicadores disponíveis, o ativo apresenta momentum positivo no curto prazo. RSI em 62.4 indica região neutra, sem sinais de sobrecompra. MACD positivo e acima da linha de sinal, sugerindo tendência de alta.

**Médias Móveis:**
O preço está acima das SMA 20, 50 e 200, configurando alinhamento altista em todos os prazos. Isso é tipicamente um sinal de força técnica.

**Bollinger Bands:**
Preço dentro das bandas, sem sinais de volatilidade extrema. Região de suporte próxima à SMA 20.

**Conclusão:**
Perspectiva técnica de curto prazo: NEUTRA a POSITIVA. Recomenda-se aguardar confirmação de rompimento antes de novas posições.

⚠️ Esta análise é apenas informativa e não constitui recomendação de investimento.`

interface Props { ticker: string }

export function AIAnalysisPanel({ ticker }: Props) {
  const [prompt, setPrompt] = useState("")
  const [output, setOutput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startStream() {
    if (streaming) return
    const text = MOCK_ANALYSIS.replace("%TICKER%", ticker)
    setOutput("")
    setStreaming(true)
    let i = 0
    timerRef.current = setInterval(() => {
      i += 3
      setOutput(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(timerRef.current!)
        setStreaming(false)
      }
    }, 20)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
        <Sparkles size={14} className="text-blue-400" />
        <h2 className="text-sm font-semibold text-neutral-200">Análise IA</h2>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <textarea
          className="bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-200 placeholder-neutral-500 p-2 resize-none outline-none focus:border-blue-600 transition-colors"
          rows={3}
          placeholder={`Pergunte sobre ${ticker}... (ex: "Qual a perspectiva técnica?")`}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
        />
        <button
          onClick={startStream}
          disabled={streaming}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
        >
          <Sparkles size={12} />
          {streaming ? "Analisando..." : "Analisar"}
        </button>
        {output && (
          <div className="bg-neutral-800/50 rounded p-3 text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {output}
            {streaming && <span className="animate-pulse">▋</span>}
          </div>
        )}
      </div>
    </div>
  )
}
```

### Task 19: FixedIncomeTable

**Files:**
- Create: `apps/web/src/app/(platform)/analysis/FixedIncomeTable.tsx`

```tsx
"use client"
import { useFixedIncome } from "@/lib/hooks/useAnalysis"
import { Badge } from "@/components/shared/Badge"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const TYPE_COLOR: Record<string, "neutral"|"blue"|"green"|"purple"> = {
  "Tesouro SELIC": "blue", "Tesouro IPCA+": "blue", "Tesouro Prefixado": "blue",
  "CDB": "neutral", "LCI": "green", "LCA": "green",
}

export function FixedIncomeTable() {
  const { data = [] } = useFixedIncome()

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-200">Renda Fixa</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="py-2 px-3 text-neutral-400 font-medium text-left">Tipo</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-left">Emissor</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Taxa</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Vencimento</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Mínimo</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-center">Rating</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-center">Liquidez</th>
            </tr>
          </thead>
          <tbody>
            {data.map(p => (
              <tr key={p.id} className="border-b border-neutral-800/40 hover:bg-neutral-800/40">
                <td className="py-2 px-3">
                  <Badge label={p.type} color={TYPE_COLOR[p.type] ?? "neutral"} />
                </td>
                <td className="py-2 px-3 text-neutral-300">{p.issuer}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-medium">{p.rate}</td>
                <td className="py-2 px-3 text-right text-neutral-300">{p.maturity}</td>
                <td className="py-2 px-3 text-right text-neutral-300">{brl(p.min_investment)}</td>
                <td className="py-2 px-3 text-center">
                  {p.rating ? <Badge label={p.rating} color="green" /> : "—"}
                </td>
                <td className="py-2 px-3 text-center">
                  <Badge
                    label={p.liquidity === "daily" ? "Diária" : "No vencimento"}
                    color={p.liquidity === "daily" ? "green" : "neutral"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### Task 20: Analysis Page Assembly

**Files:**
- Modify: `apps/web/src/app/(platform)/analysis/page.tsx`

```tsx
"use client"
import { useState } from "react"
import { AssetSearch }      from "./AssetSearch"
import { PriceChart }       from "./PriceChart"
import { IndicatorsPanel }  from "./IndicatorsPanel"
import { AIAnalysisPanel }  from "./AIAnalysisPanel"
import { FixedIncomeTable } from "./FixedIncomeTable"
import type { Asset } from "@/types"

const DEFAULT: Asset = { ticker: "PETR4", name: "Petrobras PN", type: "stock", exchange: "BOVESPA" }

export default function AnalysisPage() {
  const [asset, setAsset] = useState<Asset>(DEFAULT)

  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AssetSearch onSelect={setAsset} selected={asset.ticker} />
        <span className="text-xs text-neutral-500">{asset.name} · {asset.exchange}</span>
      </div>
      <div className="flex gap-4 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <PriceChart ticker={asset.ticker} />
          <FixedIncomeTable />
        </div>
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <IndicatorsPanel ticker={asset.ticker} />
          <AIAnalysisPanel ticker={asset.ticker} />
        </div>
      </div>
    </div>
  )
}
```

**Verification:** Navigate to `/analysis`, screenshot: search bar, price area chart, indicators table, AI panel, fixed income table.

**Commit:**
```bash
cd C:\Dev\investiq
git add apps/web/src/app/(platform)/analysis/
git commit -m "feat: implement Analysis dashboard (price chart, indicators, AI panel, fixed income)"
```

---

## Phase 5 — Área Configurações

### Task 21: AppearanceTab

**Files:**
- Create: `apps/web/src/app/(platform)/settings/AppearanceTab.tsx`

```tsx
"use client"
import { useUIStore } from "@/store/useUIStore"

const ACCENTS = ["#3b82f6","#8b5cf6","#10b981","#f97316","#ec4899","#06b6d4"]

export function AppearanceTab() {
  const { theme, setTheme, fontScale, setFontScale } = useUIStore()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">Tema</h3>
        <div className="flex gap-2">
          {(["dark","light"] as const).map(t => (
            <button key={t} onClick={() => setTheme(t)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${theme === t ? "border-blue-500 bg-blue-600/10 text-blue-400" : "border-neutral-700 text-neutral-400 hover:border-neutral-600"}`}>
              {t === "dark" ? "🌙 Escuro" : "☀️ Claro"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">Cor de Destaque</h3>
        <div className="flex gap-2">
          {ACCENTS.map(color => (
            <button key={color} onClick={() => {}}
              className="w-7 h-7 rounded-full border-2 border-neutral-700 hover:border-neutral-400 transition-colors"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">
          Tamanho da Fonte — {Math.round(fontScale * 100)}%
        </h3>
        <input
          type="range" min={0.75} max={1.5} step={0.05} value={fontScale}
          onChange={e => setFontScale(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
          <span>75%</span><span>100%</span><span>150%</span>
        </div>
      </div>
    </div>
  )
}
```

### Task 22: ProfileTab + ApiKeysTab + LLMTab

**Files:**
- Create: `apps/web/src/app/(platform)/settings/ProfileTab.tsx`
- Create: `apps/web/src/app/(platform)/settings/ApiKeysTab.tsx`
- Create: `apps/web/src/app/(platform)/settings/LLMTab.tsx`

**ProfileTab.tsx:**
```tsx
"use client"
import { useState } from "react"
import { useSettings } from "@/lib/hooks/useSettings"

export function ProfileTab() {
  const { data } = useSettings()
  const [name, setName] = useState(data?.profile.full_name ?? "")

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-neutral-400">Nome Completo</label>
        <input
          className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 outline-none focus:border-blue-600 transition-colors"
          value={name} onChange={e => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-neutral-400">Email</label>
        <input
          className="bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
          value={data?.profile.email ?? ""} readOnly
        />
        <p className="text-[10px] text-neutral-600">Email não pode ser alterado.</p>
      </div>
      <button
        onClick={() => alert("Salvo!")}
        className="w-fit px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        Salvar Perfil
      </button>
    </div>
  )
}
```

**ApiKeysTab.tsx:**
```tsx
"use client"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

interface MaskedInputProps {
  label: string
  placeholder: string
  hint: string
}

function MaskedInput({ label, placeholder, hint }: MaskedInputProps) {
  const [show, setShow] = useState(false)
  const [value, setValue] = useState("")

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-neutral-400">{label}</label>
      <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 gap-2 focus-within:border-blue-600 transition-colors">
        <input
          type={show ? "text" : "password"}
          className="bg-transparent text-sm text-neutral-200 outline-none flex-1 placeholder-neutral-600"
          value={value} onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
        />
        <button onClick={() => setShow(s => !s)} className="text-neutral-500 hover:text-neutral-300">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <p className="text-[10px] text-neutral-600">{hint}</p>
    </div>
  )
}

export function ApiKeysTab() {
  return (
    <div className="flex flex-col gap-6">
      <MaskedInput
        label="Brapi Token"
        placeholder="Seu token da API Brapi"
        hint="Obtido em brapi.dev · usado para cotações B3"
      />
      <MaskedInput
        label="Alpha Vantage Key"
        placeholder="Sua chave Alpha Vantage"
        hint="Obtida em alphavantage.co · usado para dados internacionais"
      />
      <button
        onClick={() => alert("API Keys salvas (criptografadas)!")}
        className="w-fit px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        Salvar Chaves
      </button>
    </div>
  )
}
```

**LLMTab.tsx:**
```tsx
"use client"
import { useState } from "react"
import { Eye, EyeOff, Zap } from "lucide-react"
import { useSettings } from "@/lib/hooks/useSettings"

const PROVIDERS = [
  { id: "claude",  label: "Claude (Anthropic)", badge: "Recomendado" },
  { id: "openai",  label: "OpenAI (GPT-4)",     badge: null },
  { id: "gemini",  label: "Google Gemini",       badge: null },
] as const

export function LLMTab() {
  const { data } = useSettings()
  const [provider, setProvider] = useState(data?.llm.provider ?? "claude")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [temp, setTemp] = useState(data?.llm.temperature ?? 0.7)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">Provedor LLM</h3>
        <div className="flex flex-col gap-2">
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setProvider(p.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${provider === p.id ? "border-blue-500 bg-blue-600/10" : "border-neutral-700 hover:border-neutral-600"}`}>
              <span className={`text-sm ${provider === p.id ? "text-blue-400" : "text-neutral-300"}`}>{p.label}</span>
              {p.badge && <span className="text-[10px] bg-blue-900/50 text-blue-400 border border-blue-800 rounded px-1.5 py-0.5">{p.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-neutral-400">API Key</label>
        <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 gap-2 focus-within:border-blue-600 transition-colors">
          <input
            type={showKey ? "text" : "password"}
            className="bg-transparent text-sm text-neutral-200 outline-none flex-1 placeholder-neutral-600"
            value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <button onClick={() => setShowKey(s => !s)} className="text-neutral-500 hover:text-neutral-300">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs text-neutral-400 uppercase tracking-widest mb-3">
          Temperatura — {temp.toFixed(1)}
        </h3>
        <input type="range" min={0} max={1} step={0.1} value={temp}
          onChange={e => setTemp(parseFloat(e.target.value))}
          className="w-full accent-blue-500" />
        <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
          <span>Preciso (0.0)</span><span>Criativo (1.0)</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => alert("Configurações salvas!")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          Salvar
        </button>
        <button onClick={() => alert("Conexão OK!")}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors">
          <Zap size={13} /> Testar Conexão
        </button>
      </div>
    </div>
  )
}
```

### Task 23: Settings Page Assembly

**Files:**
- Modify: `apps/web/src/app/(platform)/settings/page.tsx`

```tsx
"use client"
import { useState } from "react"
import { User, Palette, Key, Cpu } from "lucide-react"
import { ProfileTab }    from "./ProfileTab"
import { AppearanceTab } from "./AppearanceTab"
import { ApiKeysTab }    from "./ApiKeysTab"
import { LLMTab }        from "./LLMTab"

const TABS = [
  { id: "profile",    label: "Perfil",      icon: User,    component: ProfileTab },
  { id: "appearance", label: "Aparência",   icon: Palette, component: AppearanceTab },
  { id: "apikeys",    label: "API Keys",    icon: Key,     component: ApiKeysTab },
  { id: "llm",        label: "LLM / IA",    icon: Cpu,     component: LLMTab },
] as const

type TabId = typeof TABS[number]["id"]

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>("profile")
  const current = TABS.find(t => t.id === active)!
  const Component = current.component

  return (
    <div className="h-full overflow-auto p-4 flex gap-6">
      <nav className="w-48 shrink-0 flex flex-col gap-1">
        <h1 className="text-xs text-neutral-500 uppercase tracking-widest px-3 py-2">Configurações</h1>
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActive(tab.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${active === tab.id ? "bg-blue-600/10 text-blue-400 border border-blue-800/50" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"}`}>
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <h2 className="text-base font-semibold text-neutral-100 mb-6">{current.label}</h2>
        <Component />
      </div>
    </div>
  )
}
```

**Verification:** Navigate to `/settings`, screenshot: sidebar tabs, profile form, appearance controls, API key fields with show/hide, LLM selector.

**Commit:**
```bash
cd C:\Dev\investiq
git add apps/web/src/app/(platform)/settings/
git commit -m "feat: implement Settings dashboard (profile, appearance, API keys, LLM config)"
```

---

## Phase 6 — Final Verification

### Task 24: Full App Verification

**Step 1: Start server**
```
preview_start name: "web"
```

**Step 2: Check each route**
- `/investments` — 4 cards, positions table (9 rows), donut chart, rebalance table
- `/finances` — 4 cards, transactions (month filter), donut, bar chart
- `/analysis` — search bar, price chart, indicators, AI panel, fixed income table
- `/settings` — sidebar tabs, all 4 forms functional

**Step 3: Check console errors**
```
preview_console_logs level: "error"
```
Expected: No errors

**Step 4: Final commit**
```bash
cd C:\Dev\investiq
git add .
git commit -m "chore: final cleanup and verification — all 4 dashboards complete"
```

---

## Summary

| Phase | Tasks | Commits |
|-------|-------|---------|
| 0 — Dependencies | 1 | 1 |
| 1 — Foundation | 5 (types, mock, query, hooks, shared) | 5 |
| 2 — Investimentos | 5 (cards, table, chart, rebalance, page) | 1 |
| 3 — Finanças | 3 (cards+table, charts, page) | 1 |
| 4 — Análise | 6 (search, chart, indicators, AI, fixedincome, page) | 1 |
| 5 — Configurações | 3 (tabs, page, final) | 2 |
| **Total** | **23 tasks** | **~11 commits** |

**New files:** ~32 `.tsx`/`.ts` files
**Packages added:** `recharts`, `@tanstack/react-query`
