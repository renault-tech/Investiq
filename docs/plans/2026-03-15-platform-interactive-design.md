# InvestIQ — Platform Interactivity Design

**Date:** 2026-03-15
**Status:** Approved — awaiting implementation plan

---

## Goal

Transform InvestIQ from a read-only mock dashboard into a fully editable, interactive platform. Users can add/remove positions and transactions, view real candlestick charts, and have a resizable dashboard layout.

---

## Decisions Summary

| Feature | Decision |
|---------|----------|
| Data persistence | Zustand in-memory (session only) — backend connection later |
| Market data (real prices) | Next.js API routes `/api/market/*` proxying Brapi/Yahoo Finance |
| Resizable cards | `react-grid-layout` — free drag-to-resize (Grafana style) |
| Asset click | Button per row → 2 options: "Ver gráfico" (modal) or "Analisar" (→ /analysis) |
| Add position form | Modal with ticker search via Brapi, WAC auto-calculated, editable |
| Candlestick library | Lightweight Charts (TradingView) |
| State architecture | Approach A — two central Zustand stores |

---

## Architecture

### State Layer — Two Zustand Stores

**`usePortfolioStore`** (`src/store/usePortfolioStore.ts`)
```ts
interface PortfolioStore {
  positions: Position[]
  tradeHistory: Trade[]   // all buy/sell operations per ticker
  // Actions
  addPosition: (ticker: string, qty: number, price: number, date: string) => void
  addTrade: (ticker: string, type: "buy"|"sell", qty: number, price: number, date: string) => void
  removePosition: (ticker: string) => void
  resetToDemo: () => void
  clearAll: () => void
}
```
- WAC (weighted average cost) recalculated on every `addTrade`
- `removePosition` removes ticker + its trade history
- Derived values (P&L, portfolio_weight) computed from positions + current prices

**`useFinanceStore`** (`src/store/useFinanceStore.ts`)
```ts
interface FinanceStore {
  transactions: FinancialTransaction[]
  addTransaction: (t: Omit<FinancialTransaction, "id">) => void
  removeTransaction: (id: string) => void
  resetToDemo: () => void
  clearAll: () => void
}
```
- Dashboard summary stats (income, expenses, net) derived reactively from transactions

### Market Data Layer — Next.js API Routes

**`/api/market/quote/[ticker]`**
- Calls Brapi `GET /quote/{ticker}` with token from request header
- Returns: `{ ticker, name, price, change_pct, type, exchange }`

**`/api/market/history/[ticker]`**
- Query params: `range` (1d | 1w | 1mo | 3mo | 1y), `interval` (1d | 1h)
- Calls Brapi or Yahoo Finance fallback
- Returns: `OHLCV[]` for candlestick chart

**`/api/market/search/[query]`**
- Searches Brapi ticker list
- Returns: `Asset[]`

Token sourced from `X-Brapi-Token` request header (set by frontend from `useUIStore.brapiToken`).

---

## Feature Designs

### 1. Zoom Fix

**Problem:** `setFontScale` writes `--font-scale` CSS variable but `font-size` in `:root` doesn't use it.

**Fix:** In `apps/web/src/app/globals.css`, add:
```css
:root {
  font-size: calc(16px * var(--font-scale, 1));
}
```
Plus: `react-grid-layout` column widths should be in `rem` so they scale with font-size.

---

### 2. Resizable Dashboard — `react-grid-layout`

Replace current fixed flexbox layouts in each area page with `<ResponsiveGridLayout>`.

Each area defines a `defaultLayouts` config (breakpoints: lg/md/sm). Layout saved to `localStorage` per area so the user's arrangement persists across refreshes.

Widgets (cards, tables, charts) become grid items with `minW`/`minH` constraints.

**Package:** `react-grid-layout` + `react-resizable`

---

### 3. CRUD — Investments

**Add New Position Modal** (`AddPositionModal.tsx`)
- Search field using `/api/market/search` → autocomplete dropdown
- On ticker select: auto-fill name, type, exchange; fetch current price
- Fields: Ticker (locked after select), Qty, Price per unit, Date
- WAC = price (first buy). Submit → `portfolioStore.addPosition()`

**Add Trade to Existing Position** (`AddTradeModal.tsx`)
- Opened from row action button (same button as "Ver gráfico")
- Row action menu: `[ Ver gráfico | Comprar mais | Vender | Analisar | Excluir ]`
- Fields: Type (Compra/Venda), Qty, Price, Date
- On submit: `portfolioStore.addTrade()` → WAC recalculated automatically
- Venda: validates qty ≤ current position qty

**Delete Position:** confirm dialog → `portfolioStore.removePosition(ticker)`

---

### 4. CRUD — Finances

**Add Transaction Modal** (`AddTransactionModal.tsx`)
- Triggered by "+ Lançamento" button above TransactionsTable
- Fields: Date, Description, Amount, Type (Receita/Despesa), Category (select + color picker), Account
- Submit → `financeStore.addTransaction()`

**Delete Transaction:** trash icon per row → confirm → `financeStore.removeTransaction(id)`

---

### 5. Candlestick Chart — Modal (Asset Detail)

**`AssetDetailModal.tsx`**
- Triggered by row action "Ver gráfico"
- Full-width modal (~90vw × 80vh)
- Contains: `CandlestickChart` (Lightweight Charts) + `TradeHistory` table + `AddTradeModal` trigger
- `CandlestickChart` features:
  - Data from `/api/market/history/[ticker]`
  - Range buttons: 1D / 1W / 1M / 3M / 1Y
  - Horizontal price line at `position.avg_cost` (dashed yellow, labeled "P. Médio")
  - Tooltip on hover: O/H/L/C + volume

---

### 6. Analysis Area — Candlestick Toggle

**`PriceChart.tsx`** gets a chart type toggle: `Area | Candles`

- `Area`: existing Recharts AreaChart (fast, uses mock/cached data)
- `Candles`: Lightweight Charts `CandlestickSeries` with real data from `/api/market/history/[ticker]`
- Toggle button in chart header next to range buttons

---

### 7. Settings — Reset Options

In `SettingsPage`, new section **"Dados da Plataforma"**:

- **"Restaurar dados de exemplo"** → `portfolioStore.resetToDemo()` + `financeStore.resetToDemo()` — reloads all MOCK_* data
- **"Limpar todos os dados"** → confirm dialog → `portfolioStore.clearAll()` + `financeStore.clearAll()` — empty slate for user to start fresh

---

## New Files

```
src/store/
  usePortfolioStore.ts          ← new central store
  useFinanceStore.ts            ← new central store

src/app/api/market/
  quote/[ticker]/route.ts       ← Brapi proxy
  history/[ticker]/route.ts     ← OHLCV proxy
  search/route.ts               ← ticker search proxy

src/components/modals/
  AddPositionModal.tsx
  AddTradeModal.tsx
  AssetDetailModal.tsx          ← candlestick + trade history
  AddTransactionModal.tsx
  ConfirmDialog.tsx

src/components/charts/
  CandlestickChart.tsx          ← Lightweight Charts wrapper
```

## Modified Files

```
src/lib/hooks/usePortfolio.ts   ← read from usePortfolioStore
src/lib/hooks/useFinance.ts     ← read from useFinanceStore
src/lib/hooks/useAnalysis.ts    ← real data via /api/market/history
src/app/(platform)/investments/PositionsTable.tsx  ← row action menu
src/app/(platform)/investments/page.tsx            ← react-grid-layout
src/app/(platform)/finances/TransactionsTable.tsx  ← delete + add button
src/app/(platform)/finances/page.tsx               ← react-grid-layout
src/app/(platform)/analysis/PriceChart.tsx         ← candlestick toggle
src/app/(platform)/analysis/page.tsx               ← react-grid-layout
src/app/(platform)/settings/page.tsx               ← reset/clear section
src/app/globals.css                                ← zoom fix
```

## New Packages

```
react-grid-layout
react-resizable
lightweight-charts
```

---

## Implementation Order (for writing-plans)

1. **Zoom fix** — 1 CSS line (quick win)
2. **Zustand stores** — `usePortfolioStore` + `useFinanceStore` with demo + clear
3. **Hook rewiring** — hooks read from stores instead of static mock
4. **Market API routes** — `/api/market/quote`, `/history`, `/search`
5. **Candlestick chart component** — `CandlestickChart.tsx` (Lightweight Charts)
6. **Asset Detail Modal** — candlestick + trade history + add trade
7. **Add/Delete positions** — `AddPositionModal`, row action menu
8. **Add/Delete financial transactions** — `AddTransactionModal`, row delete
9. **Analysis candlestick toggle** — `PriceChart` area↔candles
10. **Settings reset/clear** — two buttons in settings
11. **react-grid-layout** — resizable dashboard for all 4 areas
