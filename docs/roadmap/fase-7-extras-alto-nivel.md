# Fase 7 — Extras de alto nível (alertas, proventos, orçamento, export)

**Objetivo:** diferenciadores que completam a proposta de "gestor patrimonial completo": alertas de preço com notificações, visão de proventos, orçamento por categoria e export de relatórios.

**Dependências:** Fases 1 (charts), 3 (finance) e 6 (infra de testes/notificações testáveis). **Grão:** 2 sessões.

---

## Tarefas

### 7.1 — Alertas de preço + notificações

A tabela `price_alerts` e o worker `workers/alert_checker.py` **já existem** — falta o restante da cadeia.

**Migração `0007_notifications_budgets.py`** (junto com 7.3):
- `notifications`: `id, user_id FK, type varchar, title varchar, body text, read_at timestamptz null, created_at` (+RLS, index `(user_id, read_at)`).

**Backend:**
- Novo módulo `apps/api/src/alerts/{router,schemas,service}.py` (prefixo `/alerts`): `GET/POST /alerts`, `PATCH/DELETE /alerts/{id}` (ticker, condição above/below, preço-alvo, ativo/inativo).
- `alert_checker.py`: ao disparar, marca `triggered_at` e **grava uma notificação**; e-mail opcional via Resend (infra já usada no reset de senha) segundo `user_settings.notify_*`.
- `GET /notifications?unread=true`, `PATCH /notifications/{id}` (marcar lida), `POST /notifications/read-all`.

**Frontend:**
- Dropdown do sino no `TopBar.tsx` (previsto na spec Institutional): badge de não-lidas, lista com marcar-como-lida; **polling TanStack 30s** (`refetchInterval`).
- Gestão de alertas: seção na página do ativo (`/investments/[ticker]`) + lista em settings ou página própria.

### 7.2 — Proventos / dividendos

Transações `dividend` já são suportadas em `investment_transactions`.

**Backend:**
- `GET /portfolios/{id}/income?year=YYYY` — agrega dividendos por mês e por ativo.
- Nova função em `calculations.py`: **yield-on-cost** por posição (dividendos 12m ÷ custo total) — com teste unitário.

**Frontend:**
- Aba "Proventos" em `/investments`: barras mensais (Recharts, reutiliza `ChartCard`), total 12m, tabela por ativo com yield-on-cost.

### 7.3 — Orçamento por categoria

**Migração `0007` (mesma da 7.1):**
- `finance_budgets`: `id, user_id FK, category_id FK finance_categories, amount numeric(18,8), period varchar default 'monthly'`, unique `(user_id, category_id)` (+RLS).

**Backend:** endpoints em `finance/router.py`: `GET/PUT /finance/budgets` (upsert por categoria); summary mensal passa a incluir `budget`/`spent` por categoria. Notificação ao estourar: check no fluxo de criação de transação (simples e imediato — decisão fechada; sem job extra).

**Frontend em `/finances`:** seção "Orçamentos": barra de progresso gasto/orçado por categoria — cor padrão até 80%, `--warning` >80%, `--danger` >100%; edição inline do valor orçado.

### 7.4 — Export de relatórios

**Backend:**
- `GET /finance/transactions/export?format=csv&from=&to=` e `GET /portfolios/{id}/export?format=csv` — `StreamingResponse`, separador `;` e decimal `,` (Excel PT-BR), UTF-8 com BOM.

**Frontend:** botão "Exportar" nas tabelas de transações e posições.

**PDF mensal (opcional, decisão fechada):** se implementado, gerar no **frontend** via print stylesheet de uma rota `/reports/monthly` (evita dependência pesada de geração de PDF no backend).

---

## Critérios de verificação

- [ ] Criar alerta "PETR4 acima de X" com X abaixo do preço atual → em ≤1 min o sino mostra a notificação; alerta com `triggered_at` preenchido.
- [ ] Registrar dividendo → aba Proventos mostra no mês correto; yield-on-cost coerente (teste unitário com valores exatos).
- [ ] Definir orçamento menor que o gasto atual → barra vermelha + notificação criada.
- [ ] Export CSV abre no Excel PT-BR com acentos e decimais corretos.
- [ ] Notificações: badge zera após "marcar todas como lidas"; RLS isola usuários.
