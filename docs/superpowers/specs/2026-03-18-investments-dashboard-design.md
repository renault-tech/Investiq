# Design Spec — `/investments` Dashboard

**Data:** 2026-03-18
**Estado:** Aprovado pelo usuário

---

## 1. Visão geral

Página `/investments` — dashboard principal de portfólios de investimentos. Substitui o placeholder atual. Consome os endpoints existentes do backend FastAPI e expõe as três ações primárias via modais (sem ocupar espaço permanente no layout).

---

## 2. Layout

```
┌─────────────────────────────────────────────────────────┐
│ Header: "Investimentos"   [+ Portfólio] [+ Ativo] [+ Tx]│
├──────────────────┬──────────────────────────────────────┤
│  Portfolio tabs  │                                       │
├──────────┬───────┴──────────────────────────────────────┤
│ Painel   │  Tabela de Posições                          │
│ Esquerdo │  Ativo │ Qtd │ PM │ Atual │ Valor │ P&L R$   │
│  (210px) │  P&L % │ Peso │ Alvo │ Rebalance │ Ações     │
│          │                                               │
│  KPIs:   │  (linhas por ativo)                          │
│  Valor   │                                               │
│  Invest. │                                               │
│  P&L     │                                               │
│  P&L %   │                                               │
│          │                                               │
│  Top 5   │                                               │
│  Posições│                                               │
└──────────┴───────────────────────────────────────────────┘
```

**Painel esquerdo (fixo 210px):** 4 KPI cards + seção "Top Posições" (5 maiores por valor de mercado).
**Painel direito (flex):** tabela scrollável com todas as posições.

---

## 3. Componentes

### 3.1 Estrutura de arquivos

```
apps/web/src/
  app/(platform)/investments/
    page.tsx                        ← Server Component (busca lista de portfólios)
  components/investments/
    InvestmentsClient.tsx           ← Client Component raiz (estado ativo, modais)
    PortfolioTabs.tsx               ← Tabs de seleção de portfólio
    LeftPanel.tsx                   ← KPI cards + Top Posições
    KpiCard.tsx                     ← Card individual de KPI
    PositionsTable.tsx              ← Tabela de posições
    RebalanceTag.tsx                ← Badge BUY/SELL colorido
    modals/
      NewPortfolioModal.tsx         ← Modal "Novo Portfólio"
      AddPositionModal.tsx          ← Modal "Adicionar Ativo"
      NewTransactionModal.tsx       ← Modal "Registrar Transação"
  lib/
    portfolio-api.ts                ← Funções fetch para a API
  hooks/
    usePortfolioSummary.ts          ← TanStack Query — summary com auto-refresh
```

### 3.2 Responsabilidades

| Componente | Responsabilidade |
|---|---|
| `page.tsx` | Busca lista de portfólios no servidor; passa para Client |
| `InvestmentsClient.tsx` | Estado do portfólio ativo, abertura de modais, layout split |
| `PortfolioTabs.tsx` | Pill tabs; onChange atualiza portfolio ativo |
| `LeftPanel.tsx` | Recebe `summary`, renderiza KPIs e top 5 |
| `PositionsTable.tsx` | Recebe `positions[]`, renderiza tabela com 11 colunas |
| `usePortfolioSummary.ts` | `useQuery` com refetchInterval 30s |
| Modais | Formulários com validação, `useMutation`, fecha ao sucesso |

---

## 4. API — endpoints utilizados

| Ação | Método | Endpoint |
|---|---|---|
| Listar portfólios | GET | `/portfolios/` |
| Criar portfólio | POST | `/portfolios/` |
| Summary + posições | GET | `/portfolios/{id}/summary` |
| **Adicionar ativo** ⚠️ | POST | `/portfolios/{id}/positions` ← **A CRIAR** |
| Registrar transação | POST | `/portfolios/transactions` |

> **Gap 1 — endpoint ausente:** o backend não expõe endpoint para adicionar um ativo (criar `PortfolioPosition`). É necessário criar `POST /portfolios/{portfolio_id}/positions` no router e um serviço `add_position(portfolio_id, ticker, broker, target_weight)`. O frontend não pode registrar transações sem um `position_id` existente.
>
> **Gap 2 — `position_id` ausente no summary:** o schema `PositionSummary` não inclui o `id` (PK) de `PortfolioPosition`. Para que o modal "Registrar Transação" submeta o `position_id` correto, este campo deve ser adicionado ao schema Pydantic `PositionSummary` no backend antes do frontend ser implementado.

---

## 5. Dados e tipos TypeScript

```ts
// Espelham os schemas Pydantic do backend

interface Portfolio {
  id: string
  name: string
  description: string | null
  currency: string
  is_default: boolean
  created_at: string
}

interface PositionSummary {
  position_id: string   // PortfolioPosition.id — necessário para TransactionCreate.position_id
                        // ⚠️ Requer adição ao schema Pydantic PositionSummary no backend
  asset_id: string
  ticker: string
  asset_name: string
  asset_type: string
  broker: string | null
  quantity: number
  avg_cost: number
  current_price: number | null
  market_value_brl: number
  cost_basis_brl: number
  pnl_absolute: number
  pnl_percent: number
  weight: number        // 0-1
  target_weight: number | null
  rebalance_action: 'buy' | 'sell' | 'hold' | null
  rebalance_delta_units: number | null
}

interface RebalanceSuggestion {
  asset_id: string
  ticker: string
  current_weight: number
  target_weight: number
  current_value_brl: number
  target_value_brl: number
  delta_value_brl: number
  delta_units: number
  action: 'buy' | 'sell' | 'hold'
}

interface PortfolioSummary {
  portfolio_id: string
  portfolio_name: string
  total_invested_brl: number
  total_market_value_brl: number
  total_pnl_absolute: number
  total_pnl_percent: number
  positions: PositionSummary[]
  rebalance_suggestions: RebalanceSuggestion[]  // não consumido nesta iteração
}
```

---

## 6. Modais — campos e validação

### Modal: Novo Portfólio
| Campo | Tipo | Validação |
|---|---|---|
| Nome | text | obrigatório, 1-100 chars |
| Descrição | textarea | opcional |
| Moeda | select (BRL/USD/EUR) | default BRL |

### Modal: Adicionar Ativo
| Campo | Tipo | Validação |
|---|---|---|
| Ticker | text | obrigatório, uppercase automático |
| Corretora | text | opcional |
| Peso alvo % | number | opcional, 0-100 |

### Modal: Registrar Transação
| Campo | Tipo | Validação |
|---|---|---|
| Ativo | select (posições do portfólio) | obrigatório |
| Tipo | select (compra/venda/dividendo/split/bônus) | obrigatório |
| Quantidade | number | obrigatório, >0 |
| Preço unitário | number | obrigatório, >0 |
| Taxas | number | default 0 |
| Taxa de câmbio | number | default 1 |
| Data | date | obrigatório |
| Notas | textarea | opcional |

Todos os modais: aparecem via overlay sobre o dashboard, animação `fadeUp`, fecham com ESC ou clique fora.

---

## 7. Estados da UI

| Estado | Comportamento |
|---|---|
| Carregando portfólios | Skeleton no painel esquerdo e tabela |
| Nenhum portfólio | Empty state: ícone + texto + botão "Criar Portfólio" |
| Portfólio sem posições | Tabela com empty state + botão "Adicionar Ativo" |
| Erro de API | Toast de erro (Sonner), dados anteriores mantidos (TanStack Query staleTime) |
| Preço indisponível | Coluna "Atual" exibe `—`, P&L cinza |
| Rebalance nulo | Coluna exibe `—` |

---

## 8. Detalhes da tabela de posições

**11 colunas:**

| # | Cabeçalho | Fonte | Formato |
|---|---|---|---|
| 1 | Ativo | `ticker` + `asset_type` | Ticker bold + tipo pequeno abaixo |
| 2 | Qtd | `quantity` | Número com 4 decimais |
| 3 | PM | `avg_cost` | R$ com 2 decimais |
| 4 | Atual | `current_price` | R$ com 2 decimais |
| 5 | Valor | `market_value_brl` | R$ com 2 decimais |
| 6 | P&L R$ | `pnl_absolute` | R$ verde/vermelho |
| 7 | P&L % | `pnl_percent` | % verde/vermelho |
| 8 | Peso | `weight` | % com 1 decimal |
| 9 | Alvo | `target_weight` | % ou `—` |
| 10 | Rebalance | `rebalance_action` + `rebalance_delta_units` | Badge BUY/SELL + qtd |
| 11 | Ações | — | Botão ghost "Transação" que abre modal com ativo pré-selecionado |

---

## 9. Auto-refresh

`usePortfolioSummary` usa `refetchInterval: 30_000` (30s) para manter preços atualizados. Indicador visual sutil de "última atualização" no canto superior direito do painel direito.

---

## 10. Backend — endpoint a criar

```python
# POST /portfolios/{portfolio_id}/positions
# Body: { ticker, broker?, target_weight? }
# Lógica:
#   1. Verificar ownership do portfólio
#   2. Buscar ou criar Asset pelo ticker (via BrAPI/Yahoo)
#   3. Verificar se posição já existe no portfólio (retornar 409 se sim)
#   4. Criar PortfolioPosition com quantity=0, avg_cost=0
#   5. Retornar a posição criada (incluindo id como position_id)
```

Adicionalmente, o schema Pydantic `PositionSummary` deve ser atualizado para incluir `position_id: uuid.UUID` mapeado de `PortfolioPosition.id`. Ambos os itens são pré-requisitos para o frontend funcionar corretamente.

---

## 11. Fora do escopo (esta iteração)

- Gráfico de alocação (pizza/donut) — fase futura
- Histórico de transações por ativo — fase futura
- Exportação CSV — fase futura
- Ordenação/filtragem da tabela — fase futura
