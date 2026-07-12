# InvestIQ — Roadmap Mestre de Implementação

**Data:** 2026-07-12
**Status:** Aprovado — pronto para execução fase a fase pelo Claude Code
**Branch de trabalho:** `claude/investment-platform-roadmap-8iet5x`

---

## Visão do produto

Plataforma completa de **gestão de investimentos** (carteiras B3/globais, renda fixa, análise técnica/fundamentalista, análise inteligente por IA) e **controle de gastos pessoais** (transações, recorrências, faturas de cartão com extração por IA, orçamentos), em PT-BR, com design institucional moderno ("Investiq Institutional": navy + emerald, Manrope, light/dark).

**Restrições globais (não negociáveis):**
- **Zero serviços pagos.** Fontes de dados exclusivamente gratuitas: yfinance, Brapi free tier, APIs do Banco Central (SGS/PTAX), bibliotecas open-source da TradingView. Ver [`../specs/2026-07-12-data-sources-free.md`](../specs/2026-07-12-data-sources-free.md).
- IA usa a infraestrutura LLM multi-provider já existente (chaves do próprio usuário, criptografadas).
- Integração opcional com **Profit (Nelogica) via DDE** para cotações em tempo real da B3. Ver [`../specs/2026-07-12-profit-dde-integration.md`](../specs/2026-07-12-profit-dde-integration.md).
- UI/UX segue [`../specs/2026-07-12-ui-ux-design.md`](../specs/2026-07-12-ui-ux-design.md) e a spec Institutional (`../superpowers/specs/2026-03-24-design-system-and-analysis-page.md`).

---

## Diagnóstico do estado atual (2026-07-12)

| Área | Estado | Referência |
|---|---|---|
| Auth backend (JWT RS256, refresh cookie, reset Resend, RLS) | ✅ Completo | `apps/api/src/auth/` |
| Engine de cálculo (Decimal: WAC, P&L, rebalance, renda fixa 252du/IR) | ✅ Completo | `apps/api/src/portfolio/calculations.py` |
| Dashboard `/investments` (tabs, KPIs, posições, 3 modais) | ✅ Completo | `apps/web/src/components/investments/` |
| Market data Yahoo + Brapi com cache Redis | ✅ Completo | `apps/api/src/market_data/` |
| LLM multi-provider (Claude/OpenAI/Gemini), chaves Fernet | ✅ Completo | `apps/api/src/ai/` |
| Settings API (backend) | ✅ Completo | `apps/api/src/settings/` |
| Análise IA `/analysis` (SSE) | ⚠️ Parcial — **parser SSE do frontend quebrado**; provider/model salvos como `"unknown"`; contrato de mensagens inacabado | `apps/web/src/components/analysis/AnalysisClient.tsx:102-122`, `apps/api/src/analysis/router.py:57-75` |
| Workers (price_refresh, alert_checker, fx_updater) | ⚠️ Implementados mas **desligados** (comentados no lifespan) | `apps/api/src/main.py:22-24` |
| Indicadores técnicos (RSI, MACD, Bollinger, SMA/EMA) | ⚠️ Código órfão — sem endpoint | `apps/api/src/analysis/indicators.py` |
| Renda fixa (projeções) | ⚠️ Código órfão | `apps/api/src/analysis/fixed_income.py` |
| Finanças pessoais | ⚠️ Só schema/migração — sem router/service/UI | `apps/api/src/finance/models.py`, migração `0003` |
| Faturas de cartão | ❌ Inexistente (nem schema) | — |
| Gráficos/visualização | ❌ Inexistente (nenhuma lib instalada) | — |
| Análise fundamentalista | ❌ Inexistente | — |
| Landing page (`/`) | ❌ Template default do create-next-app | `apps/web/src/app/page.tsx` |
| `/finances` e `/settings` (UI) | ❌ Stubs "em construção" | `apps/web/src/app/(platform)/` |
| Testes / CI / Docker | ❌ 2 unit tests, sem CI, sem Dockerfile | `apps/api/tests/` |

---

## Fases

| Fase | Entregável | Spec | Grão estimado |
|---|---|---|---|
| **0** | Correções críticas: parser SSE, provider/model reais, contrato do chat, workers ligados, health real, CI mínimo | [`fase-0-correcoes-criticas.md`](fase-0-correcoes-criticas.md) | 1 sessão |
| **1** | Gráficos no `/investments`: donut de alocação, evolução patrimonial, snapshots diários | [`fase-1-graficos-investimentos.md`](fase-1-graficos-investimentos.md) | 1–2 sessões |
| **2** | Página de ativo `/investments/[ticker]`: candlestick + indicadores técnicos + fundamentos + IA | [`fase-2-pagina-de-ativo.md`](fase-2-pagina-de-ativo.md) | 2–3 sessões |
| **3** | Módulo de finanças pessoais completo: API CRUD + recorrências + dashboard `/finances` | [`fase-3-financas-pessoais.md`](fase-3-financas-pessoais.md) | 2 sessões |
| **4** | Faturas de cartão com IA: upload PDF/CSV → extração → revisão → conciliação | [`fase-4-faturas-cartao-ia.md`](fase-4-faturas-cartao-ia.md) | 2–3 sessões |
| **5** | Design system em 100% do app, landing page, settings UI, polish mobile | [`fase-5-design-system-landing-settings.md`](fase-5-design-system-landing-settings.md) | 2 sessões |
| **6** | Qualidade/infra: testes de integração, vitest, Dockerfiles, CI completo, seed demo | [`fase-6-qualidade-infra.md`](fase-6-qualidade-infra.md) | 2 sessões |
| **7** | Extras: alertas + notificações, proventos, orçamentos, export CSV | [`fase-7-extras-alto-nivel.md`](fase-7-extras-alto-nivel.md) | 2 sessões |
| **Opcional** | Profit DDE Bridge (cotações em tempo real da B3) — após Fase 2 | [`../specs/2026-07-12-profit-dde-integration.md`](../specs/2026-07-12-profit-dde-integration.md) | 1–2 sessões |

### Grafo de dependências

```
Fase 0 ──► Fase 1 ──► Fase 2 ──► [Profit DDE Bridge — opcional]
              │
              ▼
           Fase 3 ──► Fase 4
              │
Fase 5 ◄──────┘   (depende de 0–2; pode rodar em paralelo a 3/4)
Fase 6            (após 4; o CI mínimo já vem da Fase 0)
Fase 7            (última; depende de 1, 3 e 6)
```

Dentro de cada fase, as tarefas numeradas são commits/PRs naturais.

---

## Convenções do repositório (obrigatórias em todas as fases)

**Backend (`apps/api`):**
- Módulo por domínio: `src/<dominio>/{models,schemas,service,router}.py`; router registrado em `src/main.py` sob prefixo `/api/v1`.
- Migrações Alembic em `migrations/versions/`, numeradas sequencialmente — **próxima = `0005`**.
- **Toda tabela nova tem RLS** (policies por `app.current_user_id`) — copiar o padrão de `0002_portfolio_schema.py`.
- Valores monetários **sempre `Decimal`/`numeric(18,8)`** — nunca float (seguir `calculations.py` e `shared/decimal_utils.py`).
- Rate limiting em rotas sensíveis via `shared/limiter.py` (slowapi).
- Chaves/segredos de usuário criptografados via `shared/encryption.py` (Fernet).

**Frontend (`apps/web`):**
- Rota = `page.tsx` (Server Component, SSR/prefetch) → `*Client.tsx` (client component).
- Chamadas HTTP em `src/lib/<dominio>-api.ts` usando `lib/api-client.ts` (axios com access token).
- Hooks TanStack Query em `src/hooks/`, com invalidation nas mutations.
- Estilo exclusivamente via tokens CSS (`var(--background)`, `var(--surface)`, `var(--navy)`, `var(--accent)`, `var(--danger)`, `var(--warning)`, `var(--text-*)`, `var(--border)`) — nunca cores hardcoded.
- Toasts via `sonner`; ícones via `lucide-react`; tema via `next-themes`.

**Git:** desenvolver na branch designada; commits pequenos e descritivos por tarefa; push com `git push -u origin <branch>`.

---

## Riscos globais e mitigações

1. **`lightweight-charts` v5 tem API incompatível com a v4** (`chart.addSeries(CandlestickSeries, opts)` em vez de `addCandlestickSeries()`). Fixar a versão no `package.json` e seguir a doc da versão instalada.
2. **Recharts × React 19:** instalar versão com peer dependency de React 19 (≥ 2.15 ou 3.x) — validar com `npm info recharts peerDependencies` na hora.
3. **Brapi free tier:** módulos fundamentalistas avançados podem não estar no plano gratuito. Estratégia: degradação por campo (`Optional` em tudo) + fallback yfinance. **Nunca adicionar plano pago.**
4. **Rate limits do yfinance:** mitigar com o cache Redis existente (`market_data/cache.py`) e TTLs generosos (fundamentos: 24h).
5. **Reconstrução de evolução patrimonial é custosa** para carteiras grandes: snapshots diários via worker + backfill com granularidade limitada (semanal no período `max`).
6. **Layouts de fatura variam por banco:** revisão humana obrigatória (status `review`) antes de gerar transações + `raw_text` persistido para reprocessamento.
7. **DDE do Profit é Windows-only:** integração via agente local opcional com fallback automático para Brapi/yfinance — nunca dependência obrigatória.
