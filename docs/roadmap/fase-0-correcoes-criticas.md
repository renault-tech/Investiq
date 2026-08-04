# Fase 0 — Correções críticas (destravar o que existe)

**Objetivo:** tudo que já foi construído passa a funcionar de verdade: a análise por IA renderiza o streaming corretamente, o chat de follow-up tem contrato definido, os workers rodam, o health check é real e há um CI mínimo protegendo as fases seguintes. O produto sai desta fase **sem bugs conhecidos**.

**Dependências:** nenhuma. **Grão:** 1 sessão. Cada tarefa numerada = 1 commit.

---

## Tarefas

### 0.1 — Corrigir o parser SSE do frontend

**Arquivo:** `apps/web/src/components/analysis/AnalysisClient.tsx` (~linhas 102-122)

O backend emite eventos SSE no formato `data: {"type":"delta","text":"..."}\n\n` (ver `apps/api/src/ai/factory.py:81-90`). O frontend hoje tem dois bugs:
1. `chunk.split('\\n')` — barra invertida **literal** em vez de `\n` real (também na linha ~31 em `parseSections` e nos `join`).
2. `rawText += data` — concatena o **JSON bruto** em vez de desserializar e extrair `evt.text`.

**Correção — criar `apps/web/src/lib/sse.ts`** com uma função reutilizável:

```ts
export interface StreamResult { text: string; provider: string; model: string }

export async function streamAnalysis(
  payload: AnalyzeRequest,
  onDelta: (fullText: string) => void,
  signal?: AbortSignal,
): Promise<StreamResult>
```

Requisitos da implementação:
- `fetch` com `ReadableStream` (padrão atual), mas com **buffer de linha entre chunks**: um evento SSE pode ser cortado no meio de um `read()`. Acumular `buffer += decoder.decode(value, {stream:true})`, processar apenas linhas completas (terminadas em `\n`), guardar o resto no buffer.
- Para cada linha `data: ...`: `JSON.parse` e despachar por tipo:
  - `{"type":"delta","text":...}` → `text += evt.text; onDelta(text)`
  - `{"type":"error","message":...}` → lançar erro (caller mostra toast via sonner) e abortar o reader
  - `{"type":"done", "provider":..., "model":...}` → resolver com `{text, provider, model}` (campos novos da tarefa 0.2; tolerar ausência com fallback `"unknown"`)
- Refatorar `AnalysisClient.tsx` para usar `streamAnalysis`, removendo o loop manual. Corrigir todos os `split('\\n')`/`join('\\n')` para `\n` real (inclusive em `parseSections`).

### 0.2 — Backend emite `provider`/`model` no evento `done`

**Arquivos:** `apps/api/src/ai/factory.py` (linha ~83), `apps/api/src/ai/base.py`, `claude_provider.py`, `openai_provider.py`, `gemini_provider.py`

- Adicionar à interface `LLMProvider` (em `base.py`) a propriedade `default_model: str` e o atributo `name: str` (se ainda não uniformizado), implementados nos 3 providers.
- Em `sse_stream` (factory), trocar `yield f"data: {json.dumps({'type': 'done'})}\n\n"` por payload com `provider` (nome do provider) e `model` (o `model` passado ou `provider.default_model`).
- No `AnalysisClient.tsx`, usar `provider`/`model` retornados por `streamAnalysis` no `saveAnalysis` — eliminar os `"unknown"` hardcoded (linhas ~130-131).

### 0.3 — Fechar o contrato de mensagens de análise

**Arquivos:** `apps/api/src/analysis/router.py` (linhas 57-75), `apps/api/src/analysis/schemas.py`, `apps/web/src/components/analysis/AnalysisChat.tsx`

**Decisão (resolve os comentários de dúvida deixados no router):** `POST /analyses/{id}/messages` **apenas persiste** mensagens. O streaming continua sendo responsabilidade exclusiva de `POST /ai/analyze`.

- `AddMessageRequest` ganha `role: Literal["user","assistant"] = "user"`.
- Remover o bloco de comentários de dúvida; escrever docstring limpa descrevendo o fluxo.
- Fluxo do chat no frontend (`AnalysisChat.tsx`):
  1. `POST /analyses/{id}/messages` com a mensagem `user`;
  2. `streamAnalysis` (lib da tarefa 0.1) com o histórico da análise no payload;
  3. `POST /analyses/{id}/messages` com a resposta `assistant` + provider/model do `done`.

### 0.4 — Ligar os workers

**Arquivos:** `apps/api/src/main.py` (linhas 22-24), `apps/api/src/config.py`

- Adicionar `ENABLE_SCHEDULER: bool = True` ao `Settings` (config.py) — permite desligar em testes/CI.
- No lifespan, descomentar `start_scheduler()`/`stop_scheduler()` condicionados à flag.
- Smoke test manual: subir `infrastructure/docker-compose.yml` e verificar que os 3 jobs (`price_refresh` 5min, `alert_checker` 1min, `fx_updater` diário) são agendados sem crash (log do uvicorn).

### 0.5 — `GET /health/db` real

**Arquivo:** `apps/api/src/main.py` (linhas ~55-57), usando `src/database.py`

- Executar `SELECT 1` numa sessão async e `PING` no Redis.
- Resposta: `{"status":"ok","db":"ok","redis":"ok"}`; em falha, HTTP 503 indicando qual componente falhou.

### 0.6 — CI mínimo

**Arquivo novo:** `.github/workflows/ci.yml`

Dois jobs em paralelo, disparados em push/PR:
- **api:** Python 3.11+, instala deps do `apps/api/pyproject.toml`, roda `pytest tests/unit`.
- **web:** Node 22, `npm ci` na raiz (workspaces), `npx tsc --noEmit` e `next build` em `apps/web`.

O CI completo (integração com Postgres/Redis, cobertura, Docker) vem na Fase 6 — este protege as fases 1–5.

---

## Critérios de verificação

- [ ] Gerar análise em `/analysis`: texto renderiza **incrementalmente** por seção, sem JSON cru na tela.
- [ ] Análise salva registra provider/model reais (conferir no banco: `portfolio_analyses.provider/model ≠ "unknown"`).
- [ ] Enviar follow-up no chat → recarregar a página → mensagem user e resposta assistant persistidas.
- [ ] `curl localhost:8000/api/v1/health/db` → `{"db":"ok","redis":"ok"}`; derrubar o Redis → 503.
- [ ] Log do uvicorn mostra os jobs do APScheduler agendados; após 5 min, `assets.last_price_at` atualizado.
- [ ] CI verde no push da branch.
