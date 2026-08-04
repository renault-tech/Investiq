# Fase 6 — Qualidade e infraestrutura (testes, CI completo, Docker, seed)

**Objetivo:** rede de segurança para evolução contínua e deploy reproduzível: testes de integração backend, testes frontend, Dockerfiles, CI completo e seed de dados demo.

**Dependências:** Fase 4 (para cobrir finance/cards); o CI mínimo já existe desde a Fase 0. **Grão:** 2 sessões.

---

## Tarefas

### 6.1 — Testes de integração backend

**Diretório:** `apps/api/tests/integration/` (hoje vazio).

**`conftest.py`:**
- Postgres do `infrastructure/docker-compose.yml` + **banco de teste efêmero** (criado/dropado por sessão de teste), migrações Alembic aplicadas.
- `httpx.AsyncClient` com `ASGITransport(app=app)`.
- `ENABLE_SCHEDULER=false` (flag da Fase 0).
- Fixtures: usuário autenticado (registro+login reais), mock de market providers (fixture que substitui `market_data.factory.get_provider` por provider fake determinístico), mock do LLM em `cards.ai_extractor` (retorna JSON fixo).

**Suítes:**
- `test_auth_flow.py` — registro → login → refresh → logout → forgot/reset.
- `test_portfolio_flow.py` — criar portfólio → posição → transações buy/sell → summary com WAC correto (valores exatos em Decimal).
- `test_rls.py` — usuário B não lê/escreve recursos do usuário A (portfólios, transações, análises, faturas).
- `test_finance_flow.py` — categorias seed, CRUD transações, recorrência, summary.
- `test_cards_flow.py` — upload (arquivo fixture) → review → editar item → confirm idempotente → transações geradas.

Adicionar `pytest-cov` ao `pyproject.toml`.

### 6.2 — Testes frontend

**Instalar em `apps/web`:** `vitest`, `@testing-library/react`, `@vitejs/plugin-react`, `jsdom`.
- Unit: parser SSE de `lib/sse.ts` (**teste de regressão do bug da Fase 0** — eventos cortados no meio de chunk, `\n` real, JSON por tipo), `parseSections`, formatadores BRL/percentual.
- Componentes críticos: `PositionsTable`, `InvoiceReviewTable` (edição inline), `TransactionModal` (geração de RRULE).
- **Playwright smoke (opcional):** login → dashboard → criar portfólio, contra o compose completo. Chromium já disponível no ambiente de CI da web (documentar no workflow).

### 6.3 — Dockerfiles

- **`apps/api/Dockerfile`:** multi-stage (builder com pip install → runtime slim), user não-root, `uvicorn src.main:app`, healthcheck `GET /api/v1/health/db`.
- **`apps/web/Dockerfile`:** habilitar `output: "standalone"` no `next.config`, multi-stage `node:22-alpine` (deps → build → runner não-root).
- **`infrastructure/docker-compose.yml`:** adicionar serviços `api` e `web` sob **profile `full`** (mantendo o modo só-infra Postgres+Redis para dev local).

### 6.4 — CI completo

Evoluir `.github/workflows/ci.yml`:
- **api:** `services: postgres, redis`; roda unit + integration com cobertura (upload de report como artifact).
- **web:** lint + `tsc --noEmit` + vitest + `next build`.
- **docker:** build das duas imagens (sem push) para garantir que os Dockerfiles não quebram.
- Caches: `actions/setup-node` com cache npm; pip cache.

### 6.5 — Seed de dados demo

**Arquivo novo:** `scripts/seed_demo.py` (rodável com `python -m scripts.seed_demo`, apontando para o compose):
- Usuário demo (`demo@investiq.app` / senha documentada no script).
- 2 portfólios: B3 (PETR4, VALE3, HGLG11) e internacional (AAPL, VOO), ~30 transações distribuídas em 18 meses (compras, vendas parciais, dividendos).
- Categorias + ~60 transações financeiras em 6 meses (com 3 recorrentes).
- 1 cartão com fatura em `review` (itens pré-extraídos).
- **Idempotente**: rodar duas vezes não duplica.

Essencial para QA visual das fases anteriores e screenshots da landing.

---

## Critérios de verificação

- [ ] `pytest` (unit + integration) verde local e no CI; cobertura backend reportada.
- [ ] `npx vitest run` verde; teste do parser SSE falha se o bug da Fase 0 for reintroduzido.
- [ ] `docker compose --profile full up` sobe a stack completa; `curl localhost:3000` e `curl localhost:8000/api/v1/health/db` respondem.
- [ ] Seed roda idempotente; login com usuário demo mostra dashboards populados com gráficos e fatura em revisão.
- [ ] CI completo verde no push.
