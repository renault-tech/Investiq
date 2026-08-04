# Spec: Integração Profit (Nelogica) via DDE — "InvestIQ Bridge"

**Data:** 2026-07-12
**Status:** Especificado — implementação opcional, recomendada após a Fase 2
**Motivação:** o usuário possui conta do Profit (Nelogica), que expõe cotações em tempo real da B3 via **DDE/RTD no Windows**. Isso dá ao InvestIQ uma fonte de dados em tempo real **sem custo adicional**, superior em latência ao Brapi/yfinance (que são atrasados/limitados).

---

## 1. Contexto e restrição arquitetural

- O DDE (Dynamic Data Exchange) e o RTD do ProfitChart **só existem no Windows**, na máquina onde o Profit está aberto e logado.
- O backend InvestIQ é FastAPI em Linux (container). Não há como o servidor consumir DDE diretamente.
- **Solução:** um **agente local Windows** ("InvestIQ Bridge") roda na máquina do usuário, lê as cotações do Profit via DDE e as **publica na API do InvestIQ**. O backend trata essas cotações como um provider de maior prioridade enquanto estiverem frescas, com **fallback automático** para Brapi/yfinance quando o bridge estiver offline.

```
┌────────────── Máquina Windows do usuário ──────────────┐
│  ProfitChart (logado)                                   │
│      │ DDE: =PROFIT|COT!PETR4.ULT                       │
│      ▼                                                  │
│  InvestIQ Bridge (Python + pywin32)                     │
│      │ HTTPS POST /api/v1/market/ingest/quotes          │
└──────┼──────────────────────────────────────────────────┘
       ▼
   API FastAPI ──► Redis (quote:bridge:{ticker}, TTL 60s)
                        │
                        ▼
              LocalBridgeProvider (prioridade 1 p/ B3)
              fallback: Brapi → yfinance
```

---

## 2. Backend — mudanças no InvestIQ

### 2.1 — Migração `device_tokens`
Tabela para autenticar o bridge sem expor a senha do usuário:
`device_tokens`: `id, user_id FK, name varchar ("PC Casa"), token_hash varchar (bcrypt do token), last_seen_at timestamptz, is_active bool, created_at` (+RLS). Token exibido **uma única vez** na criação (padrão API key).

### 2.2 — Endpoints (novo `market_data/ingest_router.py` ou dentro do router da Fase 2)
- `POST /market/ingest/quotes` — auth por header `X-Device-Token`; body:
  ```json
  {"quotes":[{"ticker":"PETR4","price":38.42,"bid":38.41,"ask":38.43,"volume":1234567,"ts":"2026-07-12T14:32:05-03:00"}]}
  ```
  Grava em Redis `quote:bridge:{ticker}` com **TTL 60s**. Rate limit alto mas presente (ex. 600/min por device). Valores em `Decimal`.
- `GET /market/ingest/status` — para a UI mostrar "Bridge conectado" (last_seen do device).
- `POST /settings/device-tokens`, `GET /settings/device-tokens`, `DELETE /settings/device-tokens/{id}` — gestão na tela de Settings.

### 2.3 — Provider `market_data/local_bridge.py`
- Implementa a interface `MarketDataProvider` lendo apenas do Redis (`quote:bridge:{ticker}`).
- **Frescor:** cotação com mais de 30s é considerada stale → o factory segue para o próximo provider da cadeia (Brapi → yfinance). Ver ordem de resolução em `2026-07-12-data-sources-free.md`.
- Sem histórico OHLCV via bridge na v1 (histórico continua Brapi/yfinance).

---

## 3. Agente Windows — "InvestIQ Bridge"

**Local no monorepo:** `apps/bridge/` (Python, fora do build dos demais apps).

### 3.1 — Stack
- Python 3.11+ com `pywin32` (DDE via `win32ui.dde` / módulo `dde`) — fallback: leitura RTD via COM (`win32com.client`) se o DDE clássico se mostrar instável na versão do Profit instalada.
- `httpx` para publicar na API; `pydantic-settings` para config (`bridge.toml`: URL da API, device token, lista de tickers, intervalo).

### 3.2 — Comportamento
1. Lê a lista de tickers a assinar: da config local **ou** de `GET /portfolios` (tickers das posições do usuário) — decidir na implementação; começar pela config local (mais simples, sem escopo extra de API).
2. Conecta ao servidor DDE do Profit: serviço `PROFIT`, tópico `COT`, itens no formato `TICKER.CAMPO` (ex.: `PETR4.ULT` último preço, `.OFC` melhor compra, `.OFV` melhor venda, `.VOL` volume — **confirmar os códigos de campo na documentação/planilha DDE do Profit instalado**, pois variam entre versões).
3. Advise loop (push do DDE) ou polling 1s; agrega e publica lotes a cada 1–2s via `POST /market/ingest/quotes`.
4. Resiliência: reconexão com backoff se o Profit fechar; log local; heartbeat implícito via `last_seen_at`.
5. Empacotamento: script `python -m bridge` documentado; opcional `pyinstaller` para .exe single-file.

### 3.3 — Configuração no Profit (documentar no README do bridge)
- O Profit precisa estar aberto e com o módulo DDE habilitado (menu de exportação DDE / planilha Excel: fórmulas `=PROFIT|COT!PETR4.ULT`).
- Testar primeiro no Excel para validar serviço/tópico/campos antes de rodar o bridge.

---

## 4. Segurança

- Token de dispositivo com hash bcrypt no banco; revogável na UI; escopo restrito ao endpoint de ingest (não dá acesso à conta).
- TLS obrigatório (HTTPS da API); rate limit por device; payload validado (tickers whitelist do usuário — ignorar tickers que não estão nas carteiras dele).
- Nenhum dado do Profit é armazenado além do Redis TTL 60s (cotação efêmera) — sem redistribuição de dados de mercado.

---

## 5. Fases de implementação (quando for executada)

1. **Backend** (0,5 sessão): migração `device_tokens`, endpoints de ingest/status/token, `LocalBridgeProvider` + cadeia de fallback no factory, seção "Dispositivos" em Settings.
2. **Bridge** (1 sessão): agente Python DDE → publish, config, README de instalação (só pode ser **testado de verdade na máquina Windows do usuário** — entregar com instruções de teste passo a passo: Excel primeiro, depois bridge com 1 ticker, depois carteira toda).
3. **UI** (0,5 sessão): indicador "tempo real via Profit" no dashboard/página do ativo quando a cotação vier do bridge (campo `source` no quote).

## 6. Critérios de verificação

- [ ] `POST /market/ingest/quotes` com token válido grava no Redis; com token inválido → 401; ticker fora das carteiras → ignorado.
- [ ] Com bridge ativo, summary do portfólio usa preço do bridge (verificar `source`); parar o bridge → após 30–60s, fallback automático para Brapi/yfinance sem erro visível.
- [ ] `GET /market/ingest/status` reflete `last_seen_at`.
- [ ] Na máquina do usuário: fórmula DDE no Excel funciona → bridge publica → dashboard atualiza em ~2s.
