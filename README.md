# InvestIQ

Plataforma de **gestão de investimentos** e **controle de gastos pessoais** — em português, para o investidor brasileiro.

- **Investimentos:** carteiras B3/globais e renda fixa, preços ao vivo (Yahoo/Brapi), P&L com custo médio ponderado em `Decimal`, sugestões de rebalanceamento, evolução patrimonial e alocação em gráficos, análise técnica (RSI/MACD/Bollinger/SMA/EMA em candlestick) e fundamentalista por ativo, comparador de renda fixa (CDB/LCI/LCA/Tesouro líquido de IR), e **análise inteligente por IA** (Claude/OpenAI/Gemini — com a chave do próprio usuário, criptografada).
- **Finanças pessoais:** receitas/despesas com categorias (seed PT-BR), recorrências e soft-delete, dashboard com gráficos mensais, **faturas de cartão com extração e categorização por IA** (upload PDF/CSV, revisão humana antes de confirmar).
- **Dados 100% gratuitos:** yfinance, Brapi free tier, APIs do Banco Central (SGS/PTAX); integração opcional com o **Profit (Nelogica) via DDE** para cotações em tempo real (ver spec).

## Stack

| App | Tecnologia |
|---|---|
| `apps/web` | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · TanStack Query v5 · Zustand · Recharts · lightweight-charts · Vitest · PWA |
| `apps/api` | FastAPI · SQLAlchemy 2 async · PostgreSQL 16 (Alembic) · Redis · APScheduler · JWT RS256 · pytest |
| Monorepo | Turborepo · npm workspaces |

## Como rodar (desenvolvimento local, sem Docker)

```bash
# 1. Infra local (Postgres 16 + Redis 7)
docker compose -f infrastructure/docker-compose.yml up -d

# 2. Backend
cd apps/api
pip install -e .[dev]
alembic upgrade head
uvicorn src.main:app --reload   # http://localhost:8000/api/v1

# 3. Frontend (na raiz)
npm install
npm run dev                      # http://localhost:3000
```

Variáveis de ambiente do backend em `apps/api/src/config.py`: `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` (par RSA — gere com `openssl genrsa 2048` / `openssl rsa -pubout`), `ENCRYPTION_KEY` (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`), `RESEND_API_KEY` (opcional, reset de senha), `ENABLE_SCHEDULER` (default `true`).

## Como rodar com Docker (stack completa)

```bash
export JWT_PRIVATE_KEY="$(openssl genrsa 2048)"
export JWT_PUBLIC_KEY="$(openssl rsa -pubout <<< "$JWT_PRIVATE_KEY")"
export ENCRYPTION_KEY="$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")"

docker compose -f infrastructure/docker-compose.yml --profile full up --build
# api:  http://localhost:8000/api/v1
# web:  http://localhost:3000
```

Sem `--profile full`, o compose sobe só Postgres+Redis (modo dev acima). Dockerfiles em `apps/api/Dockerfile` e `apps/web/Dockerfile` (build multi-stage, usuário não-root, healthcheck). **Nota:** o build do `apps/web` precisa de contexto na raiz do repo (`docker build -f apps/web/Dockerfile .`) — o compose já faz isso corretamente.

## Testes

```bash
# Backend — unitários (rápidos, sem infra) + integração (Postgres+Redis reais)
cd apps/api
pytest tests/unit -q
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/investiq_test \
TEST_REDIS_URL=redis://localhost:6379/1 \
pytest tests/integration -q --cov=src

# Frontend
cd apps/web
npm run test        # vitest run
npx tsc --noEmit
npm run build
```

CI (`.github/workflows/ci.yml`) roda os três jobs (api, web, docker build) em todo push/PR.

## Dados de demonstração

`python -m scripts.seed_demo` (a partir de `apps/api`, com a API rodando) cria um usuário demo com carteiras, transações, categorias e uma fatura de cartão em revisão — útil para explorar a UI populada. Ver `scripts/README.md`.

## Estado atual e roadmap

O core está implementado e testado ponta a ponta: auth, carteiras com preços ao vivo, engine de cálculo, gráficos (evolução/alocação), página de ativo (candlestick + indicadores técnicos + fundamentos + IA), finanças pessoais completas, faturas de cartão com extração por IA, design system aplicado, testes de integração e CI.

- **[Roadmap mestre](docs/roadmap/2026-07-12-master-roadmap.md)** — diagnóstico, 8 fases, dependências e riscos
- Specs por fase em [`docs/roadmap/`](docs/roadmap/) (fase-0 a fase-7)
- [Estratégia de dados gratuita](docs/specs/2026-07-12-data-sources-free.md) · [Integração Profit DDE](docs/specs/2026-07-12-profit-dde-integration.md) · [Planejamento UI/UX](docs/specs/2026-07-12-ui-ux-design.md)
- Design system "Investiq Institutional": [`docs/superpowers/specs/2026-03-24-design-system-and-analysis-page.md`](docs/superpowers/specs/2026-03-24-design-system-and-analysis-page.md)

Pendente (Fase 7): alertas de preço + notificações, aba de proventos, orçamentos por categoria, export CSV.
