# Spec: Design System Refactor + Página /analysis

**Data:** 2026-03-24
**Escopo:** Design System Institucional (shell global + migração de /investments) + nova página /analysis
**Abordagem de persistência SSE:** Stream-then-Save (Opção 1 — pode ser evoluída para save-while-streaming futuramente)

---

## 1. Sistema de Design — "Investiq Institutional"

### 1.1 Paleta de Cores (CSS Custom Properties)

```css
/* globals.css — Light Mode (padrão) */
:root {
  --background:    #F8FAFC;   /* slate-50 — fundo de página */
  --surface:       #FFFFFF;   /* cards, painéis, modais */
  --border:        #E2E8F0;   /* slate-200 — bordas padrão */
  --border-strong: #CBD5E1;   /* slate-300 — bordas de ênfase */

  --navy:          #0A192F;   /* azul marinho — nav ativa, headings, branding */
  --accent:        #10B981;   /* emerald-500 — positivo, botões de ação secundária */
  --danger:        #EF4444;   /* red-500 — P&L negativo, alertas */
  --warning:       #F59E0B;   /* amber-500 — alertas suaves */

  --text-primary:  #0F172A;   /* slate-900 */
  --text-secondary:#475569;   /* slate-600 */
  --text-muted:    #94A3B8;   /* slate-400 */
}

/* Dark Mode */
.dark {
  --background:    #020617;   /* slate-950 */
  --surface:       #0F172A;   /* slate-900 */
  --border:        #1E293B;   /* slate-800 */
  --border-strong: #334155;   /* slate-700 */
  --navy:          #1E3A5F;   /* navy clareado para contraste no escuro */
  --accent:        #34D399;   /* emerald-400 — mais legível no escuro */
  --danger:        #F87171;   /* red-400 */
  --warning:       #FCD34D;   /* amber-300 */
  --text-primary:  #F1F5F9;   /* slate-100 */
  --text-secondary:#94A3B8;   /* slate-400 */
  --text-muted:    #475569;   /* slate-600 */
}
```

### 1.2 Tipografia

- **Fonte principal:** Manrope (Google Fonts) — pesos: 400, 500, 600, 700
- **Fonte mono:** Geist Mono (mantida) — métricas, IDs, timestamps, código
- **Implementação:** `next/font/google` — variável CSS `--font-manrope`
- **Migração:** substituir `--font-geist-sans` por `--font-manrope` em `layout.tsx` e `globals.css`

### 1.3 Tokens de Forma

- **Border radius padrão:** `rounded-lg` (8px) — cards, botões, inputs, modais
- **Sombra de card:** `shadow-sm` no light mode; sem sombra no dark mode
- **Border radius menor:** `rounded-md` (6px) — badges, tags, itens de lista

### 1.4 Tema (Light/Dark)

- Light mode é o **padrão** — `<html>` sem classe `.dark` na carga inicial
- Toggle de tema permanece no TopBar (discreto — ícone Sun/Moon sem label)
- `next-themes` já está instalado; adicionar `ThemeProvider` em `providers.tsx` com `defaultTheme="light"`

---

## 2. Shell Global — Refactor de Componentes

### 2.1 `app/layout.tsx`

**Mudanças:**
- Substituir `Geist` por `Manrope` via `next/font/google`
- Manter `Geist_Mono` para fonte mono
- `theme-color` meta tag: `#0A192F` (era `#3B82F6`)
- Envolver `<Providers>` com `ThemeProvider` do `next-themes`

### 2.2 `app/globals.css`

**Mudanças:**
- Adicionar todos os tokens CSS de Seção 1.1
- Substituir `--background: #0a0a0a` e `--foreground: #ededed` pelos novos tokens
- `body`: `background: var(--background); color: var(--text-primary)`
- Adicionar variável `--font-manrope` ao body

### 2.3 `components/layout/PlatformShell.tsx`

**Mudanças:**
- `bg-neutral-950 text-neutral-100` → `bg-[var(--background)] text-[var(--text-primary)]`

### 2.4 `components/layout/Sidebar.tsx`

| Elemento | Antes | Depois |
|----------|-------|--------|
| Fundo | `bg-neutral-900` | `bg-[var(--surface)] border-r border-[var(--border)]` |
| Item ativo | `bg-blue-600 text-white` | `bg-[var(--navy)] text-white rounded-lg` |
| Item hover | `hover:bg-neutral-800` | `hover:bg-slate-100 dark:hover:bg-slate-800` |
| Texto padrão | `text-neutral-400` | `text-[var(--text-secondary)]` |
| Ícone ativo | `text-white` | `text-white` (mantém) |
| Rodapé do usuário | `bg-neutral-800` | `border-t border-[var(--border)]` |
| Nome do usuário | `text-neutral-100` | `text-[var(--text-primary)]` |
| Plano do usuário | `text-neutral-400` | `text-[var(--text-muted)]` |

**Estrutura de navegação inalterada:** Investments, Finances, Analysis, Settings.

### 2.5 `components/layout/TopBar.tsx`

**Nova estrutura (da esquerda para a direita):**

```
[InvestIQ logotipo/marca] [Busca global ──────────────] [zoom−  1.0  zoom+] [🌙/☀] [🔔] [Avatar▾]
```

| Elemento | Antes | Depois |
|----------|-------|--------|
| Fundo | `bg-neutral-900` | `bg-[var(--surface)] border-b border-[var(--border)]` |
| Logo/marca | ausente | `text-[var(--navy)] font-semibold text-sm` (esquerda) |
| Busca global | ausente | `<input>` centralizado, `rounded-lg border-[var(--border)] bg-[var(--background)]`, ícone `Search` |
| Zoom controls | `text-neutral-500` botões | discretos: ícones 14px, `text-[var(--text-muted)]`, separador `|` entre eles |
| Theme toggle | `text-neutral-500` | `text-[var(--text-muted)]` hover `text-[var(--text-primary)]` |
| Notificações | ausente | ícone `Bell`, badge de contagem (inicialmente sem backend — badge estático `0`) |
| Avatar/perfil | ausente | círculo `bg-[var(--navy)] text-white` com iniciais do usuário, dropdown com: Perfil, Configurações, Sair |

**Nota busca global:** fase 1 é apenas UI (sem backend de busca). Campo presente mas sem funcionalidade de resultado — placeholder "Buscar ativos, portfólios...".

### 2.6 Bottom Nav Mobile (novo componente)

**Arquivo:** `components/layout/BottomNav.tsx`

- Visível apenas em `< md` (mobile)
- 4 itens: Dashboard (Investments), Finanças, Análise, Relatórios
- `fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)]`
- Item ativo: ícone + label em `text-[var(--navy)]`; inativos: `text-[var(--text-muted)]`

### 2.7 Migração de `/investments`

Os componentes existentes usam classes dark hardcoded. A migração é de tokens, não de estrutura:

| Padrão atual | Padrão novo |
|-------------|-------------|
| `bg-neutral-900` | `bg-[var(--surface)]` |
| `bg-neutral-950` | `bg-[var(--background)]` |
| `bg-neutral-800` | `bg-slate-100 dark:bg-slate-800` |
| `text-neutral-100` | `text-[var(--text-primary)]` |
| `text-neutral-400` | `text-[var(--text-muted)]` |
| `border-neutral-800` | `border-[var(--border)]` |
| `bg-blue-600` | `bg-[var(--navy)]` |
| `text-blue-400` | `text-[var(--accent)]` |
| `text-green-400` | `text-[var(--accent)]` |
| `text-red-400` | `text-[var(--danger)]` |

**Componentes afetados:** KpiCard, LeftPanel, PositionsTable, RebalanceTag, NewPortfolioModal, AddPositionModal, NewTransactionModal, PortfolioTabs, InvestmentsClient.

**Abordagem:** busca global por padrões + substituição. Sem mudança de estrutura JSX.

---

## 3. Banco de Dados — Novos Modelos

### 3.1 `PortfolioAnalysis`

```python
class PortfolioAnalysis(Base):
    __tablename__ = "portfolio_analyses"

    id           = Column(UUID, primary_key=True, default=uuid4)
    portfolio_id = Column(UUID, ForeignKey("portfolios.id"), nullable=False)
    user_id      = Column(UUID, ForeignKey("users.id"), nullable=False)
    raw_text     = Column(Text, nullable=False)        # markdown completo
    sections     = Column(JSONB, nullable=False)       # {"context": "...", "summary": "...", ...}
    provider     = Column(String(50))                  # "claude" | "openai" | "gemini"
    model        = Column(String(100))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    portfolio    = relationship("Portfolio", back_populates="analyses")
    messages     = relationship("AnalysisMessage", back_populates="analysis",
                                order_by="AnalysisMessage.created_at")
```

### 3.2 `AnalysisMessage`

```python
class AnalysisMessage(Base):
    __tablename__ = "analysis_messages"

    id          = Column(UUID, primary_key=True, default=uuid4)
    analysis_id = Column(UUID, ForeignKey("portfolio_analyses.id"), nullable=False)
    role        = Column(String(20), nullable=False)   # "user" | "assistant"
    content     = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    analysis    = relationship("PortfolioAnalysis", back_populates="messages")
```

### 3.3 Migração Alembic

Nova migração adicionando as duas tabelas com índices:
- `ix_portfolio_analyses_portfolio_id`
- `ix_portfolio_analyses_user_id`
- `ix_analysis_messages_analysis_id`

---

## 4. Backend — Novos Endpoints

### 4.1 Schemas (`analysis/schemas.py`)

**Nota de ordenação:** definir `AnalysisMessageSchema` antes de `AnalysisDetail` para evitar `NameError` em Python (forward reference sem `from __future__ import annotations`).

```python
class SaveAnalysisRequest(BaseModel):
    portfolio_id: uuid.UUID
    raw_text: str
    sections: dict[str, str]           # chaves obrigatórias: context, summary, composition,
                                       # risks, opportunities, recommendations
    provider: Optional[str] = None
    model: Optional[str] = None

    @field_validator("sections")
    @classmethod
    def validate_sections_keys(cls, v: dict) -> dict:
        required = {"context", "summary", "composition", "risks", "opportunities", "recommendations"}
        missing = required - set(v.keys())
        if missing:
            raise ValueError(f"sections faltando chaves: {missing}")
        return v

# Definir antes de AnalysisDetail (evita NameError)
class AnalysisMessageSchema(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}

class AnalysisListItem(BaseModel):
    """Retornado pelo service como dict (não ORM direto) para incluir summary_snippet computado."""
    id: uuid.UUID
    created_at: datetime
    provider: Optional[str]
    model: Optional[str]
    summary_snippet: str               # computado no service: sections["summary"][:120]

class AnalysisDetail(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    raw_text: str
    sections: dict[str, str]
    provider: Optional[str]
    model: Optional[str]
    created_at: datetime
    messages: list[AnalysisMessageSchema]
    model_config = {"from_attributes": True}

class AddMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)

class RecentContextResponse(BaseModel):
    raw_texts: list[str]               # últimas N análises, do mais recente ao mais antigo
```

**Nota `AnalysisListItem`:** o campo `summary_snippet` não existe como coluna ORM. O service retorna um `dict` explícito (não a instância ORM) com `summary_snippet` já computado — mesmo padrão usado em `add_position` do módulo de portfólio.

### 4.2 Endpoints (`analysis/router.py`)

Todos os endpoints usam `current_user: User = Depends(get_current_user)` — mesmo padrão do módulo de portfólio.

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| `POST` | `/analyses` | Salva análise completa após stream | 201 |
| `GET` | `/portfolios/{id}/analyses` | Lista histórico (resumo com snippet) | 200 |
| `GET` | `/portfolios/{id}/analyses/recent-context` | Retorna `raw_text` das últimas 3 análises | 200 |
| `GET` | `/analyses/{id}` | Análise completa + mensagens | 200 |
| `POST` | `/analyses/{id}/messages` | Envia follow-up; stream SSE + salva ambos os lados | 200 (SSE) |

**`POST /analyses/{id}/messages` — contrato SSE:**
- Request body: `AddMessageRequest { content: str }`
- Fluxo: salva mensagem do usuário (`role="user"`) → abre stream para `/ai/analyze` com histórico da conversa → emite chunks como `text/event-stream`
- Formato dos eventos SSE: `data: <chunk_de_texto>\n\n` (mesmo formato do `/ai/analyze` existente)
- Ao finalizar: salva mensagem do assistente (`role="assistant"`) com texto acumulado
- Em caso de erro no stream: mensagem do usuário já salva permanece; mensagem do assistente não é criada (frontend detecta via `onerror`)

### 4.3 Modificação em `POST /ai/analyze`

Adicionar campo opcional ao request body:

```python
class AnalyzeRequest(BaseModel):
    # campos existentes...
    portfolio_id: Optional[uuid.UUID] = None
    previous_analyses: Optional[list[str]] = None   # raw_text das últimas 2-3 análises
```

**System prompt injetado quando `previous_analyses` presente:**

```
Você é um analista financeiro institucional. Ao gerar a análise, mantenha
consistência com as análises anteriores do mesmo portfólio fornecidas abaixo.
Estruture a resposta com os seguintes headers markdown exatos:
## Contexto da Análise
## Resumo Executivo
## Composição
## Riscos
## Oportunidades
## Recomendações

Análises anteriores (do mais recente ao mais antigo):
---
{análise_1}
---
{análise_2}
```

### 4.4 Service (`analysis/service.py`)

```python
async def save_analysis(portfolio_id, user_id, raw_text, sections, provider, model, db) -> dict
# retorna dict explícito (não ORM) incluindo summary_snippet computado

async def list_analyses(portfolio_id, user_id, db) -> list[dict]
# cada dict inclui: id, created_at, provider, model, summary_snippet=sections["summary"][:120]

async def get_analysis(analysis_id, user_id, db) -> PortfolioAnalysis
# lança NotFoundError se não encontrado ou user_id não bate

async def add_message(analysis_id, user_id, role, content, db) -> AnalysisMessage
# verifica ownership via get_analysis antes de inserir

async def get_recent_raw_texts(portfolio_id, user_id, limit=3, db) -> list[str]
# ORDER BY created_at DESC LIMIT limit; retorna apenas raw_text de cada registro
```

Todas as queries filtram por `user_id` para isolamento. `get_analysis` lança `NotFoundError` se não encontrado ou não pertence ao usuário.

---

## 5. Frontend — Página `/analysis`

### 5.1 Estrutura de Arquivos

```
app/(platform)/analysis/
  page.tsx                        ← Server Component (SSR: lista portfólios iniciais)

components/analysis/
  AnalysisClient.tsx              ← root client: estado global
  PortfolioSelector.tsx           ← dropdown de portfólios (independente de /investments)
  AnalysisSidebar.tsx             ← histórico de análises (lista com datas)
  AnalysisReport.tsx              ← renderiza seções do relatório
  AnalysisSection.tsx             ← bloco individual: título + markdown
  AnalysisChat.tsx                ← chat de follow-up
  AnalysisChatMessage.tsx         ← balão individual (user/assistant)
  AnalysisEmptyState.tsx          ← estado vazio + CTA
  AnalysisStreamingSkeleton.tsx   ← skeleton progressivo durante streaming

hooks/
  useAnalyses.ts                  ← GET /portfolios/{id}/analyses
  useAnalysis.ts                  ← GET /analyses/{id}
```

### 5.2 Estado (`AnalysisClient`)

```typescript
const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null)
const [activeAnalysisId, setActiveAnalysisId]   = useState<string | null>(null)
const [streaming, setStreaming]                  = useState(false)
const [streamedSections, setStreamedSections]   = useState<Record<string, string>>({})
```

### 5.3 Fluxo "Analisar"

**Nota técnica — SSE via fetch:** o endpoint `POST /ai/analyze` requer um body JSON, o que torna o `EventSource` nativo inutilizável (suporta apenas GET). Usar `fetch` com `ReadableStream` para consumir o SSE:

```typescript
const response = await fetch("/api/ai/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify(payload),
})
const reader = response.body!.getReader()
const decoder = new TextDecoder()
// loop: reader.read() → decoder.decode(chunk) → acumular rawText → parseSections()
```

**Passos do fluxo:**

1. Usuário clica "Analisar" → `streaming = true`, `streamedSections = {}`, `rawText = ""`
2. `GET /portfolios/{id}/analyses/recent-context` → obtém `{ raw_texts: string[] }` (últimas 3)
3. `GET /portfolios/{id}/summary` → obtém snapshot atual do portfólio
4. `fetch POST /ai/analyze` com body: `{ portfolio_summary, previous_analyses: raw_texts, ... }` → lê `ReadableStream`
5. Chunks chegam → acumula em `rawText` → `parseSections(rawText)` → atualiza `streamedSections` progressivamente
6. Stream termina (`reader.done === true`) → `POST /analyses` com `{ raw_text, sections, portfolio_id, provider, model }`
7. `invalidateQueries(["analyses", portfolioId])` → `streaming = false` → `activeAnalysisId` = ID retornado
8. Em caso de erro no fetch/stream → toast de erro, `streaming = false`, `rawText` descartado

### 5.4 Parse de Seções (client-side)

```typescript
const SECTION_HEADERS = {
  "## Contexto da Análise":  "context",
  "## Resumo Executivo":     "summary",
  "## Composição":           "composition",
  "## Riscos":               "risks",
  "## Oportunidades":        "opportunities",
  "## Recomendações":        "recommendations",
}

function parseSections(rawText: string): Record<string, string> {
  // split por headers, retorna objeto com chaves acima
}
```

### 5.5 Visual dos Componentes

**`AnalysisSidebar`** (220px, fixo à esquerda dentro do painel):
- Cada item: data formatada `DD mmm` + snippet de 40 chars do summary
- Item ativo: `bg-[var(--navy)] dark:bg-slate-700 text-white rounded-lg px-3 py-2`
- Item inativo: `text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-3 py-2`

**`AnalysisSection`** (cada seção do relatório):
- Header: `text-sm font-semibold text-[var(--navy)] uppercase tracking-wide mb-2`
- Corpo: markdown renderizado, `text-[var(--text-primary)] text-sm leading-relaxed`
- Divisor entre seções: `border-b border-[var(--border)] my-4`

**Timestamp discreto** (abaixo do título do relatório):
```
text-xs text-[var(--text-muted)]
"Gerado em 23 mar. 2026 às 14:32 · Claude Sonnet"
```

**`AnalysisChat`** (abaixo do relatório, só aparece com `activeAnalysisId`):
- Área de mensagens: scroll interno, `max-h-80 overflow-y-auto`
- Balão usuário: `bg-[var(--navy)] text-white rounded-lg rounded-br-sm px-3 py-2 ml-auto max-w-xs`
- Balão IA: `bg-slate-100 dark:bg-slate-800 rounded-lg rounded-bl-sm px-3 py-2 mr-auto max-w-sm`
- Input: `border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)]`
- Input desabilitado durante `streaming`

**Fluxo de follow-up (chat):**
1. Usuário envia mensagem → adiciona balão otimista ao estado local
2. `fetch POST /analyses/{id}/messages` com body `{ content }` → lê `ReadableStream` igual ao fluxo de análise
3. Chunks chegam → atualiza balão do assistente em tempo real (streaming visível)
4. Stream termina → `invalidateQueries(["analysis", activeAnalysisId])` para sincronizar lista de mensagens com o servidor
5. Em caso de erro → remove balão otimista + toast de erro

**`AnalysisEmptyState`**:
- Ícone `BarChart2` centralizado, `text-[var(--text-muted)]` tamanho 48
- Texto: "Nenhuma análise disponível" `text-[var(--text-secondary)]`
- Botão: `bg-[var(--navy)] text-white rounded-lg px-4 py-2 hover:opacity-90`

**`AnalysisStreamingSkeleton`**:
- 6 blocos `bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md`
- Alturas variadas simulando headers + parágrafos

### 5.6 Hooks TanStack Query

```typescript
// useAnalyses.ts
export function useAnalyses(portfolioId: string | null) {
  return useQuery<AnalysisListItem[]>({
    queryKey: ["analyses", portfolioId],
    queryFn: () => listAnalyses(portfolioId!),
    enabled: Boolean(portfolioId),
  })
}

// useAnalysis.ts
export function useAnalysis(analysisId: string | null) {
  return useQuery<AnalysisDetail>({
    queryKey: ["analysis", analysisId],
    queryFn: () => getAnalysis(analysisId!),
    enabled: Boolean(analysisId),
  })
}
```

### 5.7 `lib/analysis-api.ts` (novos tipos e funções)

```typescript
export type AnalysisListItem = {
  id: string
  created_at: string
  provider: string | null
  model: string | null
  summary_snippet: string
}

export type AnalysisDetail = {
  id: string
  portfolio_id: string
  raw_text: string
  sections: Record<string, string>
  provider: string | null
  model: string | null
  created_at: string
  messages: AnalysisMessage[]
}

export type AnalysisMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

export const listAnalyses      = (portfolioId: string): Promise<AnalysisListItem[]> => apiClient.get(...)
export const getRecentContext  = (portfolioId: string): Promise<{ raw_texts: string[] }> => apiClient.get(...)
export const getAnalysis       = (id: string): Promise<AnalysisDetail> => apiClient.get(...)
export const saveAnalysis      = (data: SaveAnalysisInput): Promise<{ id: string }> => apiClient.post(...)
// addMessage não usa apiClient — usa fetch diretamente (ReadableStream SSE)
// ver fluxo de follow-up em 5.5
```

---

## 6. Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| SSE cai durante stream | Toast "Falha na análise. Tente novamente." — texto parcial descartado, não salvo |
| Portfólio sem posições | Botão "Analisar" desabilitado + tooltip "Adicione posições antes de analisar" |
| Chave de API não configurada | Banner inline: "Configure seu provedor de IA em Configurações" com link para /settings |
| Follow-up enquanto streaming | Input bloqueado (`disabled`, cursor `not-allowed`) |
| `GET /analyses/{id}` 404 | Toast de erro + reset `activeAnalysisId = null` |

---

## 7. Testes Unitários Backend

```python
# tests/unit/test_analysis_service.py

async def test_save_analysis_persists_sections()
async def test_list_analyses_returns_only_user_portfolios()   # isolamento por user_id
async def test_get_analysis_raises_not_found_for_other_user()
async def test_add_message_appends_to_correct_analysis()
async def test_get_recent_raw_texts_returns_max_three()
async def test_analyze_prompt_includes_previous_context()     # verifica injeção no system prompt
```

---

## 8. Ordem de Implementação

1. **Design System** — `globals.css` tokens + Manrope em `layout.tsx` + `ThemeProvider`
2. **Shell refactor** — `PlatformShell`, `Sidebar`, `TopBar` (nova estrutura), `BottomNav` (novo)
3. **Migração `/investments`** — substituição de tokens em todos os componentes existentes
4. **Backend análise** — models + migração Alembic + schemas + service + router
5. **Frontend análise** — `analysis-api.ts`, hooks, componentes, `page.tsx`
6. **Verificação manual** — light/dark toggle, streaming, persistência, histórico, chat

---

## 9. Fora de Escopo (esta sprint)

- Funcionalidade de busca global (campo presente, sem backend)
- Sistema de notificações (ícone presente, badge estático)
- Dropdown de perfil do usuário (apenas UI, sem edição de perfil)
- `/finances`, `/settings` pages
- Testes de integração SSE end-to-end
