# Fase 1 — Gráficos e visualização no /investments

**Objetivo:** o dashboard de investimentos ganha visualização profissional — donut de alocação, gráfico de evolução patrimonial com seletor de período, e a infraestrutura de snapshots diários que alimenta o histórico.

**Dependências:** Fase 0. **Grão:** 1–2 sessões.

---

## Decisão técnica — bibliotecas de gráficos (fechada)

| Uso | Lib | Observações |
|---|---|---|
| Dashboard (donut, área, barras) | **Recharts** | Instalar versão com peer dep de React 19 (≥ 2.15 ou 3.x — validar com `npm info recharts peerDependencies`). Declarativo, SVG, fácil de tematizar. |
| Candlestick (Fase 2) | **lightweight-charts v5** (TradingView, MIT, gratuito) | Canvas imperativo, sem binding React — wrapper próprio com `useRef`/`useEffect`. API v5: `chart.addSeries(CandlestickSeries, opts)`. Fixar versão. |

Cores dos gráficos derivadas dos tokens CSS (`--accent` positivo, `--danger` negativo, `--navy` neutro, `--text-muted` eixos), lidas via `getComputedStyle` ou classes — funcionando em light e dark. Seguir as diretrizes de dataviz em `../specs/2026-07-12-ui-ux-design.md`.

---

## Tarefas — Backend

### 1.1 — Migração `0005_portfolio_snapshots.py`

Tabela `portfolio_snapshots`:

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `portfolio_id` | FK `portfolios.id` (cascade) | |
| `user_id` | FK `users.id` | para RLS |
| `snapshot_date` | `date` | unique junto com `portfolio_id` |
| `total_value` | `numeric(18,8)` | |
| `total_invested` | `numeric(18,8)` | |
| `total_pnl` | `numeric(18,8)` | |
| `currency` | `varchar(3)` | |
| `created_at` | timestamptz | |

- RLS igual às demais tabelas (copiar padrão de `0002_portfolio_schema.py`).
- Model `PortfolioSnapshot` em `apps/api/src/portfolio/models.py`.

### 1.2 — Worker de snapshot diário

**Arquivo novo:** `apps/api/src/workers/snapshot_worker.py`, registrado em `workers/scheduler.py`.

- Roda diariamente após o fechamento da B3 (~21h UTC).
- Para cada portfólio ativo: calcula valor via a lógica existente de `portfolio/service.get_portfolio_summary` e faz **upsert** do snapshot do dia (`ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE`).
- Tudo em `Decimal`.

### 1.3 — Endpoint de performance

**Arquivos:** `apps/api/src/portfolio/router.py`, `service.py`, `schemas.py`

`GET /portfolios/{id}/performance?period=1m|3m|6m|1y|max` → `[{date, total_value, total_invested}]`

Estratégia híbrida:
1. Usa `portfolio_snapshots` quando existem.
2. Para datas anteriores ao primeiro snapshot (**backfill**): reconstrói a partir de `investment_transactions` (quantidade acumulada por ativo por data) × preços históricos do provider (`get_historical`, já cacheado em `market_data/cache.py`).
3. Limitar custo: granularidade **semanal** no período `max`; diária nos demais.

### 1.4 — Alocação no summary

Estender `PortfolioSummaryResponse` (`schemas.py`) com `allocation_by_type: [{asset_type, value, weight_pct}]` — agregação simples sobre as posições já calculadas no summary (sem query extra).

---

## Tarefas — Frontend

### 1.5 — Instalar libs e criar componentes de gráfico

`npm i recharts lightweight-charts` em `apps/web` (versões conforme decisão acima).

**Novos componentes em `apps/web/src/components/charts/`:**
- `ChartCard.tsx` — wrapper com título, skeleton de loading e empty state (reutilizado em todas as fases).
- `AllocationDonut.tsx` — Recharts `PieChart` (innerRadius para donut), legenda com % e valor, tooltip formatado em BRL.
- `PortfolioEvolutionChart.tsx` — Recharts `AreaChart` com gradiente, seletor de período (1m/3m/6m/1y/max), linha secundária de aporte acumulado (`total_invested`).

### 1.6 — Integração no dashboard

**Arquivos:** `apps/web/src/components/investments/InvestmentsClient.tsx`, `LeftPanel.tsx`

- Nova seção "Visão Geral" acima da `PositionsTable`: evolução patrimonial (largura total) + donut de alocação por tipo e por ativo (toggle).
- Hook novo `apps/web/src/hooks/usePortfolioPerformance.ts`; funções novas em `apps/web/src/lib/portfolio-api.ts` (`getPerformance(portfolioId, period)`).

---

## Critérios de verificação

- [ ] Portfólio com 2+ ativos e transações em datas passadas: donut soma 100%; curva de evolução coerente com os aportes.
- [ ] Trocar período dispara nova query (cache TanStack por `[portfolioId, period]`).
- [ ] Worker cria linha em `portfolio_snapshots`; segunda chamada ao endpoint usa cache Redis de históricos (verificar latência/log).
- [ ] Dark mode: gráficos legíveis nos dois temas (eixos, tooltips, gradientes).
- [ ] Mobile 375px: gráficos empilham sem overflow horizontal.
- [ ] `pytest tests/unit` verde (adicionar teste da agregação `allocation_by_type` se ficar em `calculations.py`).
