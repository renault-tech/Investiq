# InvestIQ

Plataforma de **gestão de investimentos** e **controle de gastos pessoais** — em português, para o investidor brasileiro.

- **Investimentos:** carteiras B3/globais e renda fixa, preços ao vivo (Yahoo/Brapi), P&L com custo médio ponderado em `Decimal`, sugestões de rebalanceamento, análise técnica (RSI/MACD/Bollinger), fundamentalista e **análise inteligente por IA** (Claude/OpenAI/Gemini — com a chave do próprio usuário, criptografada).
- **Finanças pessoais:** receitas/despesas com categorias e recorrências, **faturas de cartão com extração e categorização por IA** (upload PDF/CSV), orçamentos e relatórios.
- **Dados 100% gratuitos:** yfinance, Brapi free tier, APIs do Banco Central (SGS/PTAX) e integração opcional com o **Profit (Nelogica) via DDE** para cotações em tempo real.

## Stack

| App | Tecnologia |
|---|---|
| `apps/web` | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · TanStack Query v5 · Zustand · PWA |
| `apps/api` | FastAPI · SQLAlchemy 2 async · PostgreSQL (Alembic, RLS) · Redis · APScheduler · JWT RS256 |
| Monorepo | Turborepo · npm workspaces |

## Como rodar (desenvolvimento)

```bash
# 1. Infra local (Postgres 16 + Redis 7)
docker compose -f infrastructure/docker-compose.yml up -d

# 2. Backend
cd apps/api
pip install -e .
alembic upgrade head
uvicorn src.main:app --reload   # http://localhost:8000/api/v1

# 3. Frontend (na raiz)
npm install
npm run dev                      # http://localhost:3000
```

Variáveis de ambiente do backend em `apps/api/src/config.py` (`DATABASE_URL`, `REDIS_URL`, chaves JWT, `ENCRYPTION_KEY`, `RESEND_API_KEY`).

## Estado atual e roadmap

O núcleo está funcional (auth, carteiras com preços ao vivo, engine de cálculo, análise por IA em streaming); gráficos, finanças pessoais, faturas e polish de design estão **planejados e especificados**, prontos para execução fase a fase:

- **[Roadmap mestre](docs/roadmap/2026-07-12-master-roadmap.md)** — diagnóstico, 8 fases, dependências e riscos
- Specs por fase em [`docs/roadmap/`](docs/roadmap/) (fase-0 a fase-7)
- [Estratégia de dados gratuita](docs/specs/2026-07-12-data-sources-free.md) · [Integração Profit DDE](docs/specs/2026-07-12-profit-dde-integration.md) · [Planejamento UI/UX](docs/specs/2026-07-12-ui-ux-design.md)
- Design system "Investiq Institutional": [`docs/superpowers/specs/2026-03-24-design-system-and-analysis-page.md`](docs/superpowers/specs/2026-03-24-design-system-and-analysis-page.md)
