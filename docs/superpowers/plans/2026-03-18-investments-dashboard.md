# Investments Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o dashboard `/investments` — layout split com painel de KPIs, tabela de posições e 3 modais de ação — consumindo os endpoints FastAPI existentes.

**Architecture:** Backend-first: corrigir os 2 gaps identificados no spec antes de qualquer frontend. Frontend usa TanStack Query v5 para busca e cache, Zustand para estado de modal, componentes Tailwind 4 puros (sem shadcn). A `page.tsx` é Server Component que pré-carrega a lista de portfólios; toda interatividade fica em `InvestmentsClient.tsx`.

**Tech Stack:** Next.js 16, React 19, TanStack Query v5, Zustand v5, Axios, Tailwind 4 + tailwindcss-animate (a instalar), Lucide React, Sonner (a instalar), FastAPI + SQLAlchemy (backend)

**Spec:** `docs/superpowers/specs/2026-03-18-investments-dashboard-design.md`

---

## Mapa de arquivos

### Backend — modificar
| Arquivo | O que muda |
|---|---|
| `apps/api/src/portfolio/schemas.py` | Adicionar `position_id: uuid.UUID` em `PositionSummary` |
| `apps/api/src/portfolio/service.py` | Adicionar função `add_position(...)` |
| `apps/api/src/portfolio/router.py` | Adicionar rota `POST /{portfolio_id}/positions` |

### Backend — criar (testes)
| Arquivo | O que testa |
|---|---|
| `apps/api/tests/unit/test_portfolio_service.py` | `add_position`: ownership, duplicata, criação |

### Frontend — criar
| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/providers.tsx` | QueryClient + Toaster (Sonner) |
| `apps/web/src/lib/portfolio-api.ts` | Funções fetch + tipos TypeScript |
| `apps/web/src/hooks/usePortfolioSummary.ts` | `useQuery` com refetchInterval 30s |
| `apps/web/src/components/investments/KpiCard.tsx` | Card individual de KPI |
| `apps/web/src/components/investments/LeftPanel.tsx` | 4 KPIs + Top 5 posições |
| `apps/web/src/components/investments/RebalanceTag.tsx` | Badge BUY/SELL/HOLD |
| `apps/web/src/components/investments/PortfolioTabs.tsx` | Pill tabs de seleção |
| `apps/web/src/components/investments/PositionsTable.tsx` | Tabela com 11 colunas |
| `apps/web/src/components/investments/modals/NewPortfolioModal.tsx` | Formulário Novo Portfólio |
| `apps/web/src/components/investments/modals/AddPositionModal.tsx` | Formulário Adicionar Ativo |
| `apps/web/src/components/investments/modals/NewTransactionModal.tsx` | Formulário Registrar Transação |
| `apps/web/src/components/investments/InvestmentsClient.tsx` | Client Component raiz |

### Frontend — modificar
| Arquivo | O que muda |
|---|---|
| `apps/web/src/app/layout.tsx` | Envolver `children` com `<Providers>` |
| `apps/web/src/app/(platform)/investments/page.tsx` | Substituir placeholder pelo Server Component real |

---

## Task 1: Backend — adicionar `position_id` ao schema `PositionSummary`

**Files:**
- Modify: `apps/api/src/portfolio/schemas.py`
- Modify: `apps/api/src/portfolio/service.py` (onde monta o dict de PositionSummary)

- [ ] **Step 1: Ler o serviço para entender onde `position_summaries` é montado**

```bash
grep -n "position_summaries\|pos_dict\|PortfolioPosition" apps/api/src/portfolio/service.py
```

- [ ] **Step 2: Adicionar `position_id` ao schema Pydantic**

Em `apps/api/src/portfolio/schemas.py`, na classe `PositionSummary`, adicionar como **primeiro campo**:

```python
class PositionSummary(BaseModel):
    position_id: uuid.UUID          # ← ADICIONAR (PortfolioPosition.id)
    asset_id: uuid.UUID
    ticker: str
    # ... resto dos campos existentes sem alteração
```

- [ ] **Step 3: Incluir `position_id` no dict montado pelo serviço**

Em `apps/api/src/portfolio/service.py`, na função `get_portfolio_summary`, dentro do loop que monta `position_summaries`, identificar onde `pos_dict` é construído.

Localizar o bloco:
```python
position_summaries.append({
    **pos_dict,
    "rebalance_action": ...
    "rebalance_delta_units": ...
})
```

Adicionar `"position_id"` ao dict de cada posição. O `id` vem do `PortfolioPosition` — verificar se já está em `pos_dict` ou precisa ser adicionado junto com os outros campos.

- [ ] **Step 4: Verificar que o campo `id` está sendo incluído em `pos_dict`**

```bash
grep -n "pos_dict\[" apps/api/src/portfolio/service.py | head -30
```

Se `id` não estiver em `pos_dict`, adicionar onde os campos da posição são mapeados:
```python
pos_dict["position_id"] = str(pos.id)  # ou pos.id dependendo do tipo
```

- [ ] **Step 5: Rodar os testes existentes para garantir que nada quebrou**

```bash
cd apps/api && python -m pytest tests/unit/ -v
```
Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/portfolio/schemas.py apps/api/src/portfolio/service.py
git commit -m "feat(api): expose position_id in PositionSummary schema"
```

---

## Task 2: Backend — endpoint `POST /portfolios/{portfolio_id}/positions`

**Files:**
- Modify: `apps/api/src/portfolio/service.py`
- Modify: `apps/api/src/portfolio/schemas.py`
- Modify: `apps/api/src/portfolio/router.py`
- Create: `apps/api/tests/unit/test_portfolio_service.py`

### Schemas

- [ ] **Step 1: Adicionar schemas para o novo endpoint**

Em `apps/api/src/portfolio/schemas.py`, adicionar ao final:

```python
# ---------------------------------------------------------------------------
# Add Position
# ---------------------------------------------------------------------------

class AddPositionRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    broker: Optional[str] = Field(None, max_length=100)
    target_weight: Optional[Decimal] = Field(None, ge=0, le=1)


class PositionResponse(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    asset_id: uuid.UUID
    ticker: str
    broker: Optional[str]
    quantity: Decimal
    avg_cost: Decimal
    target_weight: Optional[Decimal]
    created_at: datetime

    model_config = {"from_attributes": True}
```

### Testes (TDD)

- [ ] **Step 2: Escrever os testes para `add_position` (vão falhar)**

Criar `apps/api/tests/unit/test_portfolio_service.py`:

```python
"""Unit tests for portfolio service — add_position."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal
import uuid

from src.portfolio.service import add_position
from src.shared.exceptions import NotFoundError, ConflictError


def make_portfolio(user_id, portfolio_id=None):
    p = MagicMock()
    p.id = portfolio_id or uuid.uuid4()
    p.user_id = user_id
    return p


def make_asset(ticker):
    a = MagicMock()
    a.id = uuid.uuid4()
    a.ticker = ticker
    return a


@pytest.mark.asyncio
async def test_add_position_not_found_portfolio():
    """Raise NotFoundError when portfolio doesn't belong to user."""
    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
    with pytest.raises(NotFoundError):
        await add_position(uuid.uuid4(), uuid.uuid4(), "PETR4", None, None, db)


@pytest.mark.asyncio
async def test_add_position_conflict_duplicate():
    """Raise ConflictError when position for ticker already exists in portfolio."""
    user_id = uuid.uuid4()
    portfolio_id = uuid.uuid4()
    db = AsyncMock()
    portfolio = make_portfolio(user_id, portfolio_id)
    asset = make_asset("PETR4")
    existing_position = MagicMock()

    # First call: portfolio found; second: asset found; third: position already exists
    db.execute = AsyncMock(side_effect=[
        MagicMock(scalar_one_or_none=MagicMock(return_value=portfolio)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=asset)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=existing_position)),
    ])
    with pytest.raises(ConflictError):
        await add_position(portfolio_id, user_id, "PETR4", None, None, db)
```

- [ ] **Step 3: Rodar os testes — verificar que FALHAM com `ImportError` ou `AttributeError`**

```bash
cd apps/api && python -m pytest tests/unit/test_portfolio_service.py -v
```
Esperado: FAIL — `add_position` e `ConflictError` não existem ainda.

### Implementação

- [ ] **Step 4: Adicionar `ConflictError` às exceções**

Em `apps/api/src/shared/exceptions.py` (ou onde `NotFoundError` está definido), adicionar:

```python
class ConflictError(Exception):
    """Resource already exists."""
    pass
```

Verificar o arquivo de exceções antes:
```bash
grep -rn "class NotFoundError" apps/api/src/
```

- [ ] **Step 5: Verificar que `PortfolioPosition` tem coluna `user_id`**

```bash
grep -n "user_id" apps/api/src/portfolio/models.py | head -5
```

Esperado: uma linha com `user_id = Column(UUID...)` em `PortfolioPosition`. Se não existir, remover `user_id=user_id` do construtor no passo seguinte.

- [ ] **Step 6: Implementar `add_position` no serviço** _(numeração reajustada abaixo)_

Em `apps/api/src/portfolio/service.py`, adicionar após os imports necessários:

```python
from src.shared.exceptions import NotFoundError, ConflictError
```

Adicionar a função ao final do arquivo:

```python
async def add_position(
    portfolio_id: uuid.UUID,
    user_id: uuid.UUID,
    ticker: str,
    broker: Optional[str],
    target_weight: Optional[Decimal],
    db: AsyncSession,
) -> PortfolioPosition:
    """Add a new asset position to a portfolio (quantity=0, avg_cost=0)."""
    # 1. Verify ownership
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.id == portfolio_id)
        .where(Portfolio.user_id == user_id)
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise NotFoundError(f"Portfolio {portfolio_id} not found")

    # 2. Fetch or create Asset
    ticker_upper = ticker.upper().strip()
    result = await db.execute(select(Asset).where(Asset.ticker == ticker_upper))
    asset = result.scalar_one_or_none()
    if asset is None:
        # Create minimal asset record — prices will be fetched on next summary call
        asset = Asset(ticker=ticker_upper, name=ticker_upper, asset_type="stock", currency="BRL")
        db.add(asset)
        await db.flush()

    # 3. Check for duplicate
    result = await db.execute(
        select(PortfolioPosition)
        .where(PortfolioPosition.portfolio_id == portfolio_id)
        .where(PortfolioPosition.asset_id == asset.id)
        .where(PortfolioPosition.broker == broker)
    )
    if result.scalar_one_or_none() is not None:
        raise ConflictError(f"Position for {ticker_upper} already exists in this portfolio")

    # 4. Create position
    position = PortfolioPosition(
        portfolio_id=portfolio_id,
        user_id=user_id,
        asset_id=asset.id,
        broker=broker,
        quantity=Decimal("0"),
        avg_cost=Decimal("0"),
        total_invested=Decimal("0"),
        target_weight=target_weight,
    )
    db.add(position)
    await db.commit()
    await db.refresh(position)
    # Attach ticker for the response schema
    position.ticker = ticker_upper
    return position
```

Verificar os imports já existentes no service.py e adicionar os que faltam:
```bash
head -30 apps/api/src/portfolio/service.py
```

- [ ] **Step 6: Rodar os testes — verificar que PASSAM**

```bash
cd apps/api && python -m pytest tests/unit/test_portfolio_service.py -v
```
Esperado: todos os testes passando.

- [ ] **Step 7: Expor o endpoint no router**

Em `apps/api/src/portfolio/router.py`, adicionar ao final:

```python
from src.portfolio.schemas import AddPositionRequest, PositionResponse
from src.shared.exceptions import ConflictError, NotFoundError
from fastapi import HTTPException


@router.post("/{portfolio_id}/positions", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
async def add_position_to_portfolio(
    portfolio_id: uuid.UUID,
    body: AddPositionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new asset position to a portfolio."""
    try:
        return await service.add_position(
            portfolio_id=portfolio_id,
            user_id=current_user.id,
            ticker=body.ticker,
            broker=body.broker,
            target_weight=body.target_weight,
            db=db,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
```

- [ ] **Step 8: Rodar todos os testes do backend**

```bash
cd apps/api && python -m pytest tests/ -v
```
Esperado: todos passando.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/portfolio/schemas.py apps/api/src/portfolio/service.py apps/api/src/portfolio/router.py apps/api/tests/unit/test_portfolio_service.py
git commit -m "feat(api): add POST /portfolios/{id}/positions endpoint"
```

---

## Task 3: Frontend — infraestrutura (Sonner + QueryProvider)

**Files:**
- Create: `apps/web/src/providers.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Instalar Sonner e tailwindcss-animate**

```bash
cd apps/web && npm install sonner tailwindcss-animate
```

- [ ] **Step 1b: Registrar o plugin no CSS global**

Em `apps/web/src/app/globals.css`, adicionar na primeira linha:

```css
@plugin "tailwindcss-animate";
```

Isso habilita as classes `animate-in`, `fade-in`, `slide-in-from-bottom-*` usadas nos modais.

- [ ] **Step 2: Criar `providers.tsx`**

Criar `apps/web/src/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useRef } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 20_000,
          retry: 1,
        },
      },
    });
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      {children}
      <Toaster position="top-right" theme="dark" richColors />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Envolver o app com `<Providers>` em `layout.tsx`**

Em `apps/web/src/app/layout.tsx`, importar e envolver `children`:

```tsx
import { Providers } from "@/providers";

// Dentro do RootLayout, trocar:
//   <body ...>{children}</body>
// Por:
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
```

- [ ] **Step 4: Verificar que o app ainda compila**

```bash
cd apps/web && npx next build 2>&1 | tail -5
```
Esperado: sem erros de build.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/providers.tsx apps/web/src/app/layout.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat(web): add QueryProvider and Sonner toaster"
```

---

## Task 4: Frontend — tipos e funções de API

**Files:**
- Create: `apps/web/src/lib/portfolio-api.ts`

- [ ] **Step 1: Criar `portfolio-api.ts`**

Criar `apps/web/src/lib/portfolio-api.ts`:

```typescript
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
```

- [ ] **Step 2: Verificar que o TypeScript compila sem erros**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sem erros relacionados a `portfolio-api.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/portfolio-api.ts
git commit -m "feat(web): add portfolio API client and TypeScript types"
```

---

## Task 5: Frontend — hook `usePortfolioSummary`

**Files:**
- Create: `apps/web/src/hooks/usePortfolioSummary.ts`

- [ ] **Step 1: Criar o hook**

Criar `apps/web/src/hooks/usePortfolioSummary.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { getPortfolioSummary, type PortfolioSummary } from "@/lib/portfolio-api";

export function usePortfolioSummary(portfolioId: string | null) {
  return useQuery<PortfolioSummary>({
    queryKey: ["portfolio-summary", portfolioId],
    queryFn: () => getPortfolioSummary(portfolioId!),
    enabled: Boolean(portfolioId),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/usePortfolioSummary.ts
git commit -m "feat(web): add usePortfolioSummary hook with 30s auto-refresh"
```

---

## Task 6: Frontend — `KpiCard` e `LeftPanel`

**Files:**
- Create: `apps/web/src/components/investments/KpiCard.tsx`
- Create: `apps/web/src/components/investments/LeftPanel.tsx`

- [ ] **Step 1: Criar `KpiCard.tsx`**

Criar `apps/web/src/components/investments/KpiCard.tsx`:

```tsx
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: "green" | "red" | "neutral";
}

export function KpiCard({ label, value, sub, subColor = "neutral" }: KpiCardProps) {
  const subColorClass =
    subColor === "green"
      ? "text-green-500"
      : subColor === "red"
      ? "text-red-500"
      : "text-neutral-500";

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
      <p className="text-[9px] uppercase tracking-widest text-neutral-600 mb-1">{label}</p>
      <p className="text-[17px] font-bold text-white leading-none">{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${subColorClass}`}>{sub}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Criar `LeftPanel.tsx`**

Criar `apps/web/src/components/investments/LeftPanel.tsx`:

```tsx
import { KpiCard } from "./KpiCard";
import type { PortfolioSummary } from "@/lib/portfolio-api";

interface LeftPanelProps {
  summary: PortfolioSummary | undefined;
  isLoading: boolean;
}

function fmt(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function fmtPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function LeftPanel({ summary, isLoading }: LeftPanelProps) {
  if (isLoading) {
    return (
      <div className="w-[210px] shrink-0 border-r border-neutral-800 p-3 flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-neutral-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const pnlPositive = (summary?.total_pnl_absolute ?? 0) >= 0;
  const top5 = [...(summary?.positions ?? [])]
    .sort((a, b) => b.market_value_brl - a.market_value_brl)
    .slice(0, 5);

  return (
    <div className="w-[210px] shrink-0 border-r border-neutral-800 p-3 flex flex-col gap-2 overflow-y-auto">
      <KpiCard
        label="Valor de Mercado"
        value={fmt(summary?.total_market_value_brl ?? 0)}
      />
      <KpiCard
        label="Total Investido"
        value={fmt(summary?.total_invested_brl ?? 0)}
      />
      <KpiCard
        label="P&L"
        value={fmt(summary?.total_pnl_absolute ?? 0)}
        subColor={pnlPositive ? "green" : "red"}
      />
      <KpiCard
        label="Retorno"
        value={fmtPct(summary?.total_pnl_percent ?? 0)}
        subColor={pnlPositive ? "green" : "red"}
      />

      {top5.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 mt-1">
          <p className="text-[9px] uppercase tracking-widest text-neutral-600 mb-2">
            Top Posições
          </p>
          {top5.map((pos) => (
            <div key={pos.asset_id} className="flex justify-between items-center py-1">
              <span className="text-[11px] font-semibold text-neutral-200">{pos.ticker}</span>
              <span
                className={`text-[10px] ${
                  pos.pnl_percent >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {fmtPct(pos.pnl_percent)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/investments/KpiCard.tsx apps/web/src/components/investments/LeftPanel.tsx
git commit -m "feat(web): add KpiCard and LeftPanel components"
```

---

## Task 7: Frontend — `RebalanceTag` e `PositionsTable`

**Files:**
- Create: `apps/web/src/components/investments/RebalanceTag.tsx`
- Create: `apps/web/src/components/investments/PositionsTable.tsx`

- [ ] **Step 1: Criar `RebalanceTag.tsx`**

Criar `apps/web/src/components/investments/RebalanceTag.tsx`:

```tsx
interface RebalanceTagProps {
  action: "buy" | "sell" | "hold" | null;
  deltaUnits: number | null;
}

export function RebalanceTag({ action, deltaUnits }: RebalanceTagProps) {
  if (!action || action === "hold") return <span className="text-neutral-600">—</span>;

  const isBuy = action === "buy";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
        isBuy
          ? "bg-blue-950 text-blue-400"
          : "bg-red-950 text-red-400"
      }`}
    >
      {isBuy ? "COMPRAR" : "VENDER"}
      {deltaUnits !== null && (
        <span className="opacity-70">{Math.abs(deltaUnits).toFixed(2)}</span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Criar `PositionsTable.tsx`**

Criar `apps/web/src/components/investments/PositionsTable.tsx`:

```tsx
import { RebalanceTag } from "./RebalanceTag";
import type { PositionSummary } from "@/lib/portfolio-api";

interface PositionsTableProps {
  positions: PositionSummary[];
  isLoading: boolean;
  onAddTransaction: (positionId: string, ticker: string) => void;
}

function fmtBRL(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function PositionsTable({
  positions,
  isLoading,
  onAddTransaction,
}: PositionsTableProps) {
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-neutral-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500">
        <div className="text-center">
          <p className="text-sm mb-1">Nenhuma posição neste portfólio</p>
          <p className="text-xs text-neutral-600">Use "+ Ativo" para adicionar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="border-b border-neutral-800">
            {[
              "Ativo", "Qtd", "PM", "Atual", "Valor",
              "P&L R$", "P&L %", "Peso", "Alvo", "Rebalance", "Ações",
            ].map((h) => (
              <th
                key={h}
                className={`px-2 py-2 text-[9px] font-medium text-neutral-600 uppercase tracking-wider whitespace-nowrap ${
                  h === "Ativo" ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const pnlPositive = pos.pnl_absolute >= 0;
            const pnlColor = pnlPositive ? "text-green-500" : "text-red-500";
            return (
              <tr
                key={pos.position_id}
                className="border-b border-neutral-900 hover:bg-neutral-900/50 transition-colors"
              >
                <td className="px-2 py-1.5 text-left">
                  <span className="block text-[11px] font-semibold text-neutral-100">
                    {pos.ticker}
                  </span>
                  <span className="block text-[9px] text-neutral-600">
                    {pos.asset_type}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-400">
                  {pos.quantity.toFixed(4)}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-400">
                  {fmtBRL(pos.avg_cost)}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-400">
                  {fmtBRL(pos.current_price)}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-300">
                  {fmtBRL(pos.market_value_brl)}
                </td>
                <td className={`px-2 py-1.5 text-right ${pnlColor}`}>
                  {fmtBRL(pos.pnl_absolute)}
                </td>
                <td className={`px-2 py-1.5 text-right ${pnlColor}`}>
                  {fmtPct(pos.pnl_percent)}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-400">
                  {(pos.weight * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-500">
                  {pos.target_weight !== null
                    ? `${(pos.target_weight * 100).toFixed(1)}%`
                    : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <RebalanceTag
                    action={pos.rebalance_action}
                    deltaUnits={pos.rebalance_delta_units}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={() => onAddTransaction(pos.position_id, pos.ticker)}
                    className="text-[9px] text-blue-400 border border-blue-900/30 bg-blue-950/20 px-2 py-0.5 rounded hover:bg-blue-950/50 transition-colors"
                  >
                    Transação
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/investments/RebalanceTag.tsx apps/web/src/components/investments/PositionsTable.tsx
git commit -m "feat(web): add RebalanceTag and PositionsTable components"
```

---

## Task 8: Frontend — modais

**Files:**
- Create: `apps/web/src/components/investments/modals/NewPortfolioModal.tsx`
- Create: `apps/web/src/components/investments/modals/AddPositionModal.tsx`
- Create: `apps/web/src/components/investments/modals/NewTransactionModal.tsx`

### Padrão compartilhado dos modais

Todos os modais seguem este padrão:
- Overlay escuro `position: fixed, inset-0, z-50`
- Fechar com ESC (`useEffect` com `keydown`) e clique fora (`onClick` no overlay)
- Animação `fadeUp` via Tailwind `animate-` ou classe inline
- `useMutation` do TanStack Query
- `toast.success/toast.error` do Sonner
- Invalidar query `["portfolio-summary", portfolioId]` e `["portfolios"]` no `onSuccess`

- [ ] **Step 1: Criar `NewPortfolioModal.tsx`**

Criar `apps/web/src/components/investments/modals/NewPortfolioModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createPortfolio } from "@/lib/portfolio-api";

interface NewPortfolioModalProps {
  onClose: () => void;
}

export function NewPortfolioModal({ onClose }: NewPortfolioModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("BRL");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => createPortfolio({ name, description: description || undefined, currency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      toast.success("Portfólio criado!");
      onClose();
    },
    onError: () => toast.error("Erro ao criar portfólio"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-[360px] p-5 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-white">Novo Portfólio</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
              placeholder="Ex: Longo Prazo"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500 resize-none"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Moeda</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
            >
              <option value="BRL">BRL — Real</option>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-md hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="px-3 py-1.5 text-[11px] text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Criando..." : "Criar Portfólio"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `AddPositionModal.tsx`**

Criar `apps/web/src/components/investments/modals/AddPositionModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { addPosition } from "@/lib/portfolio-api";

interface AddPositionModalProps {
  portfolioId: string;
  onClose: () => void;
}

export function AddPositionModal({ portfolioId, onClose }: AddPositionModalProps) {
  const queryClient = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [broker, setBroker] = useState("");
  const [targetPct, setTargetPct] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      addPosition(portfolioId, {
        ticker: ticker.toUpperCase().trim(),
        broker: broker.trim() || undefined,
        target_weight: targetPct ? parseFloat(targetPct) / 100 : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      toast.success(`Ativo ${ticker.toUpperCase()} adicionado!`);
      onClose();
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      const msg = error?.response?.data?.detail ?? "Erro ao adicionar ativo";
      toast.error(msg);
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-[360px] p-5 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-white">Adicionar Ativo</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Ticker *</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              maxLength={20}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500 font-mono"
              placeholder="Ex: PETR4"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Corretora</label>
            <input
              type="text"
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
              placeholder="Ex: XP, Clear (opcional)"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Peso Alvo %</label>
            <input
              type="number"
              value={targetPct}
              onChange={(e) => setTargetPct(e.target.value)}
              min={0}
              max={100}
              step={0.1}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
              placeholder="Ex: 10 (opcional)"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-md hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!ticker.trim() || mutation.isPending}
            className="px-3 py-1.5 text-[11px] text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `NewTransactionModal.tsx`**

Criar `apps/web/src/components/investments/modals/NewTransactionModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createTransaction } from "@/lib/portfolio-api";
import type { PositionSummary } from "@/lib/portfolio-api";

interface NewTransactionModalProps {
  portfolioId: string;
  positions: PositionSummary[];
  preselectedPositionId?: string;
  onClose: () => void;
}

const TRANSACTION_TYPES = [
  { value: "buy", label: "Compra" },
  { value: "sell", label: "Venda" },
  { value: "dividend", label: "Dividendo" },
  { value: "split", label: "Desdobramento" },
  { value: "bonus", label: "Bonificação" },
] as const;

export function NewTransactionModal({
  portfolioId,
  positions,
  preselectedPositionId,
  onClose,
}: NewTransactionModalProps) {
  const queryClient = useQueryClient();
  const [positionId, setPositionId] = useState(preselectedPositionId ?? "");
  const [txType, setTxType] = useState<string>("buy");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [fxRate, setFxRate] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      createTransaction({
        position_id: positionId,
        transaction_type: txType as "buy" | "sell" | "dividend" | "split" | "bonus",
        quantity: parseFloat(quantity),
        unit_price: parseFloat(unitPrice),
        fees: parseFloat(fees) || 0,
        fx_rate: parseFloat(fxRate) || 1,
        transaction_date: date,  // YYYY-MM-DD direto do input; evita bug de UTC offset
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
      toast.success("Transação registrada!");
      onClose();
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      const msg = error?.response?.data?.detail ?? "Erro ao registrar transação";
      toast.error(msg);
    },
  });

  const isValid = positionId && quantity && unitPrice && parseFloat(quantity) > 0 && parseFloat(unitPrice) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-[400px] p-5 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-white">Registrar Transação</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Ativo *</label>
            <select
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
            >
              <option value="">Selecione um ativo</option>
              {positions.map((p) => (
                <option key={p.position_id} value={p.position_id}>
                  {p.ticker} {p.broker ? `(${p.broker})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Tipo *</label>
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-neutral-400 mb-1">Quantidade *</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={0}
                step="any"
                className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-1">Preço Unit. *</label>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                min={0}
                step="any"
                className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
                placeholder="32.50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-neutral-400 mb-1">Taxas</label>
              <input
                type="number"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                min={0}
                step="any"
                className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-1">Câmbio</label>
              <input
                type="number"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                min={0}
                step="any"
                className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Data *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] text-neutral-100 outline-none focus:border-blue-500 resize-none"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-md hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="px-3 py-1.5 text-[11px] text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Registrando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/investments/modals/
git commit -m "feat(web): add NewPortfolioModal, AddPositionModal, NewTransactionModal"
```

---

## Task 9: Frontend — `PortfolioTabs`, `InvestmentsClient` e `page.tsx`

**Files:**
- Create: `apps/web/src/components/investments/PortfolioTabs.tsx`
- Create: `apps/web/src/components/investments/InvestmentsClient.tsx`
- Modify: `apps/web/src/app/(platform)/investments/page.tsx`

- [ ] **Step 1: Criar `PortfolioTabs.tsx`**

Criar `apps/web/src/components/investments/PortfolioTabs.tsx`:

```tsx
import type { Portfolio } from "@/lib/portfolio-api";

interface PortfolioTabsProps {
  portfolios: Portfolio[];
  activeId: string | null;
  onChange: (id: string) => void;
}

export function PortfolioTabs({ portfolios, activeId, onChange }: PortfolioTabsProps) {
  if (portfolios.length === 0) return null;

  return (
    <div className="flex gap-1.5 px-4 pb-2 flex-wrap">
      {portfolios.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3 py-1 rounded-full text-[11px] border transition-colors ${
            activeId === p.id
              ? "bg-blue-700 text-white border-blue-700"
              : "bg-transparent text-neutral-500 border-neutral-700 hover:text-neutral-200 hover:border-neutral-500"
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Criar `InvestmentsClient.tsx`**

Criar `apps/web/src/components/investments/InvestmentsClient.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { listPortfolios } from "@/lib/portfolio-api";
import type { Portfolio } from "@/lib/portfolio-api";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { PortfolioTabs } from "./PortfolioTabs";
import { LeftPanel } from "./LeftPanel";
import { PositionsTable } from "./PositionsTable";
import { NewPortfolioModal } from "./modals/NewPortfolioModal";
import { AddPositionModal } from "./modals/AddPositionModal";
import { NewTransactionModal } from "./modals/NewTransactionModal";

interface InvestmentsClientProps {
  initialPortfolios: Portfolio[];
}

type ModalState =
  | { type: "none" }
  | { type: "new-portfolio" }
  | { type: "add-position" }
  | { type: "new-transaction"; preselectedPositionId?: string };

export function InvestmentsClient({ initialPortfolios }: InvestmentsClientProps) {
  const { data: portfolios = initialPortfolios } = useQuery({
    queryKey: ["portfolios"],
    queryFn: listPortfolios,
    initialData: initialPortfolios,
  });

  const defaultId = portfolios.find((p) => p.is_default)?.id ?? portfolios[0]?.id ?? null;
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(defaultId);
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  // Auto-seleciona o primeiro portfólio quando a lista atualiza (ex: após criar um novo)
  useEffect(() => {
    if (!activePortfolioId && portfolios.length > 0) {
      setActivePortfolioId(portfolios[0].id);
    }
  }, [portfolios, activePortfolioId]);

  const { data: summary, isLoading: summaryLoading, dataUpdatedAt } = usePortfolioSummary(activePortfolioId);

  const openTransaction = useCallback((positionId: string) => {
    setModal({ type: "new-transaction", preselectedPositionId: positionId });
  }, []);

  const closeModal = useCallback(() => setModal({ type: "none" }), []);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  if (portfolios.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 text-sm mb-3">Nenhum portfólio encontrado</p>
          <button
            onClick={() => setModal({ type: "new-portfolio" })}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[12px] rounded-lg hover:bg-blue-500"
          >
            <Plus size={14} /> Criar Portfólio
          </button>
        </div>
        {modal.type === "new-portfolio" && <NewPortfolioModal onClose={closeModal} />}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
        <h1 className="text-[14px] font-semibold text-white">Investimentos</h1>
        <div className="flex gap-1.5">
          <button
            onClick={() => setModal({ type: "new-portfolio" })}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-md hover:bg-neutral-700"
          >
            <Plus size={11} /> Portfólio
          </button>
          <button
            onClick={() => setModal({ type: "add-position" })}
            disabled={!activePortfolioId}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-md hover:bg-neutral-700 disabled:opacity-40"
          >
            <Plus size={11} /> Ativo
          </button>
          <button
            onClick={() => setModal({ type: "new-transaction" })}
            disabled={!activePortfolioId || (summary?.positions.length ?? 0) === 0}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={11} /> Transação
          </button>
        </div>
      </div>

      {/* Portfolio Tabs */}
      <PortfolioTabs
        portfolios={portfolios}
        activeId={activePortfolioId}
        onChange={setActivePortfolioId}
      />

      {/* Split body */}
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel summary={summary} isLoading={summaryLoading} />

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Table header with last updated */}
          <div className="px-4 py-2 flex items-center justify-between shrink-0 border-b border-neutral-800">
            <span className="text-[9px] text-neutral-600 uppercase tracking-wider">Posições</span>
            {lastUpdated && (
              <span className="text-[9px] text-neutral-700">Atualizado às {lastUpdated}</span>
            )}
          </div>

          <PositionsTable
            positions={summary?.positions ?? []}
            isLoading={summaryLoading}
            onAddTransaction={openTransaction}
          />
        </div>
      </div>

      {/* Modals */}
      {modal.type === "new-portfolio" && <NewPortfolioModal onClose={closeModal} />}
      {modal.type === "add-position" && activePortfolioId && (
        <AddPositionModal portfolioId={activePortfolioId} onClose={closeModal} />
      )}
      {modal.type === "new-transaction" && activePortfolioId && (
        <NewTransactionModal
          portfolioId={activePortfolioId}
          positions={summary?.positions ?? []}
          preselectedPositionId={modal.preselectedPositionId}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Substituir o placeholder em `page.tsx`**

Substituir o conteúdo de `apps/web/src/app/(platform)/investments/page.tsx`:

```tsx
import { listPortfolios } from "@/lib/portfolio-api";
import { InvestmentsClient } from "@/components/investments/InvestmentsClient";

export default async function InvestmentsPage() {
  let initialPortfolios = [];
  try {
    initialPortfolios = await listPortfolios();
  } catch {
    // Sem cookies de auth no servidor → InvestmentsClient fará o fetch no client
  }

  return <InvestmentsClient initialPortfolios={initialPortfolios} />;
}
```

> **Nota:** `listPortfolios` usa o `apiClient` (axios) que depende do cookie httpOnly de autenticação. Em Server Components sem contexto de requisição adequado, o fetch pode falhar — o `try/catch` garante que o client renderize vazio e o TanStack Query fará o fetch no lado cliente normalmente. Uma melhoria futura seria usar fetch nativo com `cookies()` do Next.js.

- [ ] **Step 4: Verificar TypeScript completo**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```
Esperado: 0 erros.

- [ ] **Step 5: Build de produção**

```bash
cd apps/web && npx next build 2>&1 | tail -15
```
Esperado: build bem-sucedido sem erros.

- [ ] **Step 6: Commit final**

```bash
git add apps/web/src/components/investments/PortfolioTabs.tsx apps/web/src/components/investments/InvestmentsClient.tsx apps/web/src/app/(platform)/investments/page.tsx
git commit -m "feat(web): complete /investments dashboard — KPIs, positions table, modals"
```

---

## Verificação manual pós-implementação

Com o backend (`uvicorn`) e frontend (`next dev`) rodando:

1. **Acessar `/investments`** — deve renderizar sem erros de console
2. **Estado sem portfólio** — deve exibir empty state com botão "Criar Portfólio"
3. **Criar portfólio** — clicar em "+ Portfólio", preencher, submeter → tab aparece
4. **Adicionar ativo** — clicar em "+ Ativo", digitar "PETR4", submeter → ativo aparece na tabela
5. **Registrar transação** — clicar "Transação" na linha do ativo → modal abre com ativo pré-selecionado
6. **Auto-refresh** — aguardar 30s → "Atualizado às" deve atualizar o horário
7. **ESC nos modais** — pressionar ESC deve fechar o modal
8. **Clicar fora** — clicar no overlay deve fechar o modal
