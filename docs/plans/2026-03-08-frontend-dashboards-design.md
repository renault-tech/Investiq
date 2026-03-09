# Frontend Dashboards Design
**Date:** 2026-03-08
**Status:** Approved
**Scope:** All 4 platform areas — Investimentos, Finanças, Análise, Configurações

## Context

The InvestIQ backend is fully implemented (20 tasks complete). The frontend has the
PlatformShell layout, Sidebar, TopBar, and auth pages (login/register/forgot-password),
but all 4 platform areas are stubs ("Dashboard em construção"). This document designs
the full frontend implementation.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data strategy | Mock data first, real API later | Faster visual iteration; swap queryFn to go live |
| Visual style | Dense/professional (Bloomberg-style) | Max information density, dark theme |
| Implementation order | Foundation-first | Shared types/components built once, reused by all 4 areas |
| Charts | Recharts | Already in stack; good React integration |
| State | TanStack Query + Zustand | Server state via Query, UI state via Zustand |

## Architecture

### Foundation Layer

#### `src/types/index.ts`
All shared TypeScript interfaces:
```
User, AuthResponse
Portfolio, Position, InvestmentTransaction
PortfolioSummary { total_value, total_invested, total_pnl, total_pnl_pct, day_change, day_change_pct }
RebalanceSuggestion { asset, ticker, current_weight, target_weight, diff, buy_quantity, buy_value }
FinanceCategory, FinancialTransaction, BankAccount
FinanceDashboard { monthly_income, monthly_expenses, net, accounts_total, by_category[] }
Asset, OHLCV, TechnicalIndicators
UserSettings, ApiKeys, LLMConfig
```

#### `src/lib/mock-data.ts`
Static realistic data:
- 8 positions: mix of Brazilian (PETR4, VALE3, ITUB4, WEGE3) and US (AAPL, MSFT, BTC-USD, ETH-USD)
- 30 financial transactions across 3 months
- 6 finance categories with colors
- OHLCV series for 1 asset (90 days)
- Settings defaults

#### `src/lib/query-client.ts`
TanStack Query client with defaults:
- `staleTime: 60_000` (1 min)
- `gcTime: 300_000` (5 min)
- Retry: 1

#### `src/lib/hooks/`
One hook per domain, returning `{ data, isLoading, error }`:
- `usePortfolioSummary()` — summary cards data
- `usePositions()` — positions table rows
- `useRebalance()` — rebalance suggestions
- `useFinanceDashboard()` — finance summary cards
- `useTransactions(filters?)` — paginated transactions
- `useAssetOHLCV(ticker, range)` — price chart data
- `useSettings()` — user settings
- `useMutateSettings()` — save settings

#### `src/components/shared/`
| Component | Props | Usage |
|-----------|-------|-------|
| `StatCard` | label, value, change?, changeType?, icon? | All summary sections |
| `DataTable<T>` | columns[], data[], onRowClick? | Positions, Transactions |
| `LoadingSkeleton` | variant: card\|table\|chart | All loading states |
| `EmptyState` | message, icon? | No data scenarios |
| `Badge` | label, color | Category, asset type |
| `PercentChange` | value | Green/red ± display |

---

## Area 1 — Investimentos (`/investments`)

### Layout
```
┌─────────────────────────────────────────────┐
│  [Total]   [P&L]   [Dia]   [Retorno %]      │  ← 4 StatCards
├───────────────────────────┬─────────────────┤
│                           │  AllocationChart │
│     PositionsTable        │  (donut)        │
│                           ├─────────────────┤
│                           │  RebalancePanel │
└───────────────────────────┴─────────────────┘
```

### Components

**`PortfolioSummaryCards`**
Uses `usePortfolioSummary()`. Renders 4 `StatCard`s:
- Patrimônio Total (BRL formatted)
- P&L Total (value + %)
- Variação Hoje (value + %)
- Retorno Total %

**`PositionsTable`**
Uses `usePositions()`. Columns: Ticker · Nome · Qtd · P. Médio · P. Atual · Valor · P&L · P&L% · % Carteira.
Row click → opens `PositionDetailModal` (stub for now).
Sortable columns. `PercentChange` component for P&L%.

**`AllocationChart`**
Uses `usePositions()`. Recharts `PieChart` (donut style).
Toggle: by asset / by sector / by geography.
Legend with color dots and percentages.

**`RebalancePanel`**
Uses `useRebalance()`. Table: Ativo · Atual% · Alvo% · Diferença · Sugestão (comprar X un. = R$ Y).
"Executar Rebalanceamento" button → stub toast "Em breve".

---

## Area 2 — Finanças (`/finances`)

### Layout
```
┌─────────────────────────────────────────────┐
│  [Receita]   [Despesas]   [Saldo]           │  ← 3 StatCards
├───────────────────────────┬─────────────────┤
│                           │  CategoryDonut  │
│   TransactionsTable       ├─────────────────┤
│   (with month/category    │  MonthlyBarChart│
│    filters)               │  (6 months)     │
└───────────────────────────┴─────────────────┘
```

### Components

**`FinanceSummaryCards`**
Uses `useFinanceDashboard()`. 3 StatCards: Receita Mês · Despesas Mês · Saldo Líquido.

**`TransactionsTable`**
Uses `useTransactions(filters)`. Columns: Data · Descrição · Categoria (Badge) · Conta · Valor.
Filter bar: month picker + category multi-select.
Amounts colored: green for income, red for expense.

**`CategoryDonutChart`**
Recharts PieChart. Expense breakdown by category. Tooltip shows amount + %.

**`MonthlyBarChart`**
Recharts BarChart. Grouped bars: Receita (green) vs Despesa (red) for last 6 months.

---

## Area 3 — Análise (`/analysis`)

### Layout
```
┌─────────────────────────────────────────────┐
│  🔍 AssetSearch [ticker input + dropdown]   │
├───────────────────────────┬─────────────────┤
│                           │  IndicatorsPanel│
│   PriceChart              ├─────────────────┤
│   (Recharts Area, OHLCV)  │  AIAnalysis     │
│   [1D][1W][1M][1Y] toggle │  Panel          │
├───────────────────────────┴─────────────────┤
│   FixedIncomeTable (full width)             │
└─────────────────────────────────────────────┘
```

### Components

**`AssetSearch`**
Debounced input (300ms). Dropdown shows matching mock assets (name + ticker + type badge).
On select → updates chart + indicators context.

**`PriceChart`**
Uses `useAssetOHLCV(ticker, range)`. Recharts `AreaChart` with gradient fill.
Time range toggle: 1D · 1W · 1M · 1A. Price + volume subgraph.

**`IndicatorsPanel`**
Table of technical indicators with mock values:
RSI (14) · MACD · Signal · SMA 20/50/200 · Bollinger upper/lower.
Each row: name · value · signal (BUY/SELL/NEUTRAL badge).

**`AIAnalysisPanel`**
Prompt textarea + "Analisar" button.
Mock SSE streaming: simulates token-by-token output with `setInterval`.
Output rendered in pre-formatted block.

**`FixedIncomeTable`**
Mock data: 6 fixed income products (CDB, LCI, LCA, Tesouro SELIC, Tesouro IPCA+).
Columns: Tipo · Emissor · Taxa · Vencimento · Mínimo · Rating.

---

## Area 4 — Configurações (`/settings`)

### Layout
Vertical tab list (left 200px) + content panel (right).

### Tabs

**Perfil**
Form: Nome Completo · Email (readonly) · [Alterar Senha button → inline form].
Save button → stub toast.

**Aparência**
Dark/Light toggle (wired to `useUIStore`).
Accent color swatches (6 options: blue, purple, green, orange, pink, cyan).
Font scale slider (75%–150%, wired to `useUIStore`).

**API Keys**
Fields: Brapi Token · Alpha Vantage Key.
Displayed masked (`••••••••xxxx`). Show/hide toggle. Save → stub toast.

**LLM**
Provider selector: Claude · OpenAI · Gemini.
API Key field (masked). Temperature slider (0.0–1.0).
"Testar conexão" button → stub response.

---

## Dependencies to Install

```bash
cd C:\Dev\investiq && npm install recharts @tanstack/react-query --workspace=@investiq/web
```

## File Tree (new files only)

```
apps/web/src/
├── types/
│   └── index.ts
├── lib/
│   ├── mock-data.ts
│   ├── query-client.ts
│   └── hooks/
│       ├── usePortfolio.ts
│       ├── useFinance.ts
│       ├── useAnalysis.ts
│       └── useSettings.ts
├── components/
│   └── shared/
│       ├── StatCard.tsx
│       ├── DataTable.tsx
│       ├── LoadingSkeleton.tsx
│       ├── EmptyState.tsx
│       ├── Badge.tsx
│       └── PercentChange.tsx
└── app/(platform)/
    ├── investments/
    │   ├── page.tsx              (replaces stub)
    │   ├── PortfolioSummaryCards.tsx
    │   ├── PositionsTable.tsx
    │   ├── AllocationChart.tsx
    │   └── RebalancePanel.tsx
    ├── finances/
    │   ├── page.tsx              (replaces stub)
    │   ├── FinanceSummaryCards.tsx
    │   ├── TransactionsTable.tsx
    │   ├── CategoryDonutChart.tsx
    │   └── MonthlyBarChart.tsx
    ├── analysis/
    │   ├── page.tsx              (replaces stub)
    │   ├── AssetSearch.tsx
    │   ├── PriceChart.tsx
    │   ├── IndicatorsPanel.tsx
    │   ├── AIAnalysisPanel.tsx
    │   └── FixedIncomeTable.tsx
    └── settings/
        ├── page.tsx              (replaces stub)
        ├── ProfileTab.tsx
        ├── AppearanceTab.tsx
        ├── ApiKeysTab.tsx
        └── LLMTab.tsx
```

## Non-Goals (deferred to API integration phase)

- Real API calls (all data via mock hooks for now)
- Authentication guards on routes (middleware handles redirect)
- WebSocket real-time price updates
- Actual AI streaming (simulated with setInterval)
- Form persistence beyond toast feedback
