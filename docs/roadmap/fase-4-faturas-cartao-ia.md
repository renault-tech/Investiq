# Fase 4 — Faturas de cartão com IA (upload PDF/CSV → extração → conciliação)

**Objetivo:** o usuário faz upload da fatura do cartão (PDF ou CSV do banco); a IA extrai os lançamentos e sugere categorias; o usuário revisa e confirma; a confirmação gera `financial_transactions` conciliadas. Usa a infra LLM multi-provider existente (chave do próprio usuário — **custo zero de plataforma**).

**Dependências:** Fase 3 (categorias e transações). **Grão:** 2–3 sessões.

---

## Schema — migração `0006_credit_cards.py` (todas com RLS, padrão de `0002`)

**`credit_cards`**
| Coluna | Tipo |
|---|---|
| `id` UUID PK, `user_id` FK | |
| `name` varchar | apelido ("Nubank", "Itaú Click") |
| `brand` varchar | visa/master/elo/amex/outro |
| `last4` char(4) | |
| `credit_limit` numeric(18,8) null | |
| `closing_day` int, `due_day` int | dia de fechamento/vencimento |
| `is_active` bool, timestamps | |

**`card_invoices`** — unique `(card_id, reference_month)`
| Coluna | Tipo |
|---|---|
| `id`, `user_id`, `card_id` FK | |
| `reference_month` date | 1º dia do mês de referência |
| `due_date` date null | |
| `status` varchar | `processing` \| `review` \| `confirmed` \| `failed` |
| `total_amount` numeric null | |
| `file_name` varchar, `raw_text` text | texto extraído persistido p/ reprocessamento |
| `error_message` text null, timestamps | |

**`invoice_items`**
| Coluna | Tipo |
|---|---|
| `id`, `user_id`, `invoice_id` FK | |
| `description` varchar, `amount` numeric(18,8), `purchase_date` date null | |
| `installment_no` int null, `installment_total` int null | parcelas ("3/10") |
| `suggested_category_id` FK `finance_categories` null | sugestão da IA |
| `category_id` FK `finance_categories` null | escolha final do usuário |
| `financial_transaction_id` UUID null | preenchido na confirmação |
| `is_ignored` bool default false, timestamps | |

---

## Tarefas — Backend (novo módulo `apps/api/src/cards/`)

### 4.1 — Parser de arquivos

**Arquivo novo:** `cards/parser.py`. **Dep nova:** `pdfplumber` no `pyproject.toml` (`python-multipart` já existe).
- PDF → texto via pdfplumber (limite 5MB e nº máx. de páginas, ex. 30).
- CSV → decodificação tolerante (utf-8 → latin-1) e separador `;` ou `,` detectado.
- Saída: texto bruto normalizado (persistido em `card_invoices.raw_text`).

### 4.2 — Extrator IA

**Arquivo novo:** `cards/ai_extractor.py`
- Usa `ai.factory.get_llm_provider` + `provider.complete()` (não-stream, já existe em `ai/base.py`).
- Prompt: texto da fatura + lista de categorias do usuário → **JSON estrito**:
  ```json
  {"items":[{"description":"...","amount":123.45,"date":"2026-06-15","installment_no":null,"installment_total":null,"suggested_category":"Alimentação"}],"total":1234.56,"due_date":"2026-07-10"}
  ```
- Validação por schema Pydantic; JSON inválido → **retry 1x** com mensagem de correção; falha final → invoice `failed` com `error_message`.
- Texto > ~30k chars → chunking com merge dos resultados.
- Mapear `suggested_category` (string) → `suggested_category_id` por matching case-insensitive; sem match → null.

### 4.3 — Service + Router

**Arquivos novos:** `cards/models.py`, `schemas.py`, `service.py`, `router.py` (prefixo `/cards`, registrar em `main.py`).

Endpoints:
- `GET/POST /cards`, `PATCH/DELETE /cards/{id}` — CRUD de cartões.
- `POST /cards/{id}/invoices` — multipart upload → parse → extração IA → status `review`. Processamento **inline** com timeout generoso (upgrade futuro para background task documentado no código). **Rate limit `10/hour`** via `shared/limiter.py` (chamadas LLM custam para o usuário).
- `GET /cards/{id}/invoices`, `GET /cards/invoices/{invoice_id}` (com items).
- `PATCH /cards/invoices/{invoice_id}/items/{item_id}` — editar categoria/valor/data/ignorar.
- `POST /cards/invoices/{invoice_id}/confirm` — cria uma `financial_transaction` (expense, categoria final, data da compra ou do vencimento) por item não-ignorado, gravando `invoice_items.financial_transaction_id`; **tudo numa única transação DB**; **idempotente** (segunda chamada → 409).
- `DELETE /cards/invoices/{invoice_id}` — permitido apenas se não confirmada.

---

## Tarefas — Frontend

### 4.4 — Rota e componentes

**Rota nova:** `apps/web/src/app/(platform)/finances/cards/page.tsx` (+ entrada na navegação: item "Cartões" na `Sidebar.tsx` ou aba dentro de Finanças — seguir o sitemap do UI/UX spec).

**Componentes em `apps/web/src/components/cards/`:**
- `CardsClient.tsx` — orquestra lista de cartões + faturas do cartão selecionado.
- `CreditCardList.tsx` — cards visuais (bandeira, últimos 4 dígitos, limite, dias de fechamento/vencimento).
- `CardModal.tsx` — criar/editar cartão.
- `InvoiceUploadZone.tsx` — drag-and-drop + file picker; estados `processing` (spinner + mensagem "IA extraindo lançamentos…"), `failed` (erro amigável + retry).
- `InvoiceReviewTable.tsx` — itens editáveis inline: select de categoria (destaque quando sem sugestão), toggle ignorar, edição de valor/data; total recalculado ao vivo.
- `InvoiceConfirmBar.tsx` — sticky: total, nº de itens ativos/ignorados, botão "Confirmar fatura".

### 4.5 — Data layer

**Novos:** `apps/web/src/lib/cards-api.ts` (upload multipart com progress), `apps/web/src/hooks/useCards.ts`. Após confirmar → invalidar queries de finance (transações aparecem em `/finances` e nos gráficos).

---

## Critérios de verificação

- [ ] Upload de PDF de fatura real (ex. Nubank/Itaú) → itens extraídos com valores corretos e categorias sugeridas plausíveis; CSV idem.
- [ ] Editar categoria de um item e confirmar → transações aparecem em `/finances` no mês correto; donut de categorias atualiza.
- [ ] PDF ilegível/protegido → invoice `failed` com mensagem amigável (sem 500); `raw_text` vazio registrado.
- [ ] Confirmação idempotente: segundo `POST /confirm` → 409, nenhuma transação duplicada.
- [ ] Upload nº 11 na mesma hora → 429 (rate limit).
- [ ] Itens ignorados não geram transação.
- [ ] RLS: faturas invisíveis para outro usuário.
