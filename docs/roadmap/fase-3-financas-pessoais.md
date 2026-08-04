# Fase 3 — Módulo de finanças pessoais completo

**Objetivo:** dar vida ao schema já migrado (`finance_categories`, `financial_transactions` com RRULE/tags/soft-delete — migração `0003`): API CRUD completa + UI `/finances` com dashboard de gastos, filtros e gráficos.

**Dependências:** Fase 1 (componentes `charts/` reutilizados). **Grão:** 2 sessões.

---

## Tarefas — Backend (completar `apps/api/src/finance/`)

### 3.1 — Schemas

**Arquivo novo:** `apps/api/src/finance/schemas.py`
- `CategoryCreate/Update/Response` (name, category_type `income|expense`, color, icon).
- `TransactionCreate/Update/Response`: `transaction_type in {income, expense, transfer}`, `amount` Decimal, `description`, `category_id`, `transaction_date`, `recurrence_rule: str | None` (RRULE), `tags: list[str]` (serializada em JSON no campo `Text` do model), `notes`.
- `TransactionFilter` (período, categoria, tipo, texto livre, tags, paginação `page/per_page`).
- `FinanceSummaryResponse`: totais income/expense/saldo do mês, variação vs mês anterior, `by_category: [{category, value, pct}]`, `monthly_series: [{month, income, expense}]` (12 meses).

### 3.2 — Service

**Arquivo novo:** `apps/api/src/finance/service.py`
- **Categorias:** CRUD respeitando unique `(user_id, name, category_type)`. **Seed de categorias padrão PT-BR** na primeira chamada do usuário (Alimentação, Moradia, Transporte, Saúde, Educação, Lazer, Assinaturas, Outros; income: Salário, Rendimentos, Outros) com `color`/`icon` predefinidos.
- **Transações:** CRUD com soft-delete (`deleted_at`), filtros e paginação; queries sempre filtram `deleted_at IS NULL`.
- **Recorrências (decisão fechada — materialização lazy):**
  - interpretar `recurrence_rule` com `dateutil.rrule` (**adicionar `python-dateutil` ao `pyproject.toml`**);
  - listagem/summary expandem **ocorrências virtuais** futuras sem criar linhas no banco;
  - job leve registrado em `workers/scheduler.py` materializa ocorrências vencidas do mês corrente (cria linhas reais, idempotente).
- `get_summary(user_id, month)`: agregações do `FinanceSummaryResponse`.

### 3.3 — Router

**Arquivo novo:** `apps/api/src/finance/router.py` (prefixo `/finance`, registrar em `main.py`):
- `GET/POST /finance/categories`, `PATCH/DELETE /finance/categories/{id}`
- `GET/POST /finance/transactions`, `PATCH/DELETE /finance/transactions/{id}`
- `GET /finance/summary?month=YYYY-MM`

### 3.4 — Testes unitários

**Arquivo novo:** `apps/api/tests/unit/test_finance_service.py` — expansão RRULE (mensal/semanal/anual, limites de janela), soft-delete, seed idempotente de categorias.

---

## Tarefas — Frontend

### 3.5 — Substituir o stub `/finances`

**Arquivos:** `apps/web/src/app/(platform)/finances/page.tsx` → `apps/web/src/components/finances/FinancesClient.tsx`

**Componentes em `apps/web/src/components/finances/`:**
- `SummaryCards.tsx` — receita/despesa/saldo do mês + variação % vs mês anterior (setinha `--accent`/`--danger`).
- `ExpensesByCategoryDonut.tsx` — reutiliza `ChartCard` + padrão do `AllocationDonut` (cores das categorias vêm do campo `color`).
- `MonthlyFlowChart.tsx` — barras income vs expense, 12 meses (Recharts `BarChart`).
- `TransactionsTable.tsx` — paginada; ícone/cor da categoria, badge "recorrente", ações editar/excluir por linha.
- `TransactionFilters.tsx` — período (mês/intervalo), categoria, tipo, busca por texto, tags.
- `TransactionModal.tsx` — criar/editar; toggle de recorrência (mensal/semanal/anual → gera a RRULE correspondente); validação inline.
- `CategoryManager.tsx` — modal de gestão de categorias com color picker e seleção de ícone (lucide).

### 3.6 — Data layer

**Novos:** `apps/web/src/lib/finance-api.ts`, `apps/web/src/hooks/useFinance.ts` (queries `["finance","transactions",filters]`, `["finance","summary",month]`, `["finance","categories"]`; mutations com invalidation).

---

## Critérios de verificação

- [ ] Criar despesa recorrente mensal → aparece no mês corrente e projeta nos próximos meses (virtual); job materializa ao vencer.
- [ ] Excluir transação → some da lista; no banco, `deleted_at` preenchido (soft-delete).
- [ ] Donut de categorias bate com a soma da tabela filtrada; filtro por categoria/período reflete em tabela **e** gráficos.
- [ ] Seed: primeiro acesso de um usuário novo já mostra categorias padrão PT-BR.
- [ ] RLS: usuário B não vê transações do usuário A (validar; teste automatizado formal na Fase 6).
- [ ] `pytest tests/unit/test_finance_service.py` verde.
- [ ] Mobile: cards empilham, tabela com scroll horizontal contido, filtros colapsam em drawer/accordion.
