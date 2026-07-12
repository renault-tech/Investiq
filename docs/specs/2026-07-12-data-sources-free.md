# Spec: Estratégia de Dados 100% Gratuita

**Data:** 2026-07-12
**Política:** nenhum provider pago é adicionado ao projeto, em nenhuma fase. Campos indisponíveis nas fontes gratuitas são `Optional` no backend e exibidos como "indisponível" na UI — nunca bloqueiam uma tela.

---

## Matriz fonte × dado

| Dado | Fonte primária | Fallback | Custo | Já integrado? |
|---|---|---|---|---|
| Cotações B3 (ações/FIIs/ETFs) | Profit DDE Bridge (opcional, tempo real) | Brapi free → yfinance (`.SA`) | R$ 0 | Brapi/Yahoo sim |
| Cotações globais (EUA etc.) | yfinance | — | R$ 0 | Sim |
| Histórico OHLCV | yfinance / Brapi | — | R$ 0 | Sim (`get_historical`) |
| Fundamentos B3 (P/L, LPA…) | Brapi free (`?fundamental=true`) | yfinance `.SA` (`get_info()`) | R$ 0 | Não (Fase 2) |
| Fundamentos globais | yfinance (`get_info()`) | — | R$ 0 | Não (Fase 2) |
| CDI / SELIC / IPCA | **Banco Central — API SGS** | — | R$ 0, sem chave | Não |
| Câmbio PTAX (USD/BRL) | **Banco Central — API PTAX (Olinda)** | yfinance (`BRL=X`) | R$ 0, sem chave | Não (worker `fx_updater` existe) |
| Candlestick (renderização) | **lightweight-charts** (TradingView, MIT) | widget gratuito TradingView (embed) | R$ 0 | Não (Fases 1–2) |
| Extração de faturas (IA) | LLM multi-provider existente (chave do usuário) | — | custo da chave do usuário | Sim (infra) |

---

## Detalhes por fonte

### yfinance (Yahoo Finance)
- **Gratuito, sem chave.** Cobre global e B3 via sufixo `.SA` (ex.: `PETR4.SA`).
- Cotações, OHLCV histórico, fundamentos via `Ticker.get_info()` (`trailingPE`, `priceToBook`, `dividendYield`, `returnOnEquity`, `profitMargins`, `marketCap`, `fiftyTwoWeekHigh/Low`...).
- **Riscos:** é API não-oficial — sujeita a rate limits e mudanças. Mitigação: **cache Redis existente** (`market_data/cache.py`) com TTLs generosos (quote: minutos; histórico: horas; fundamentos: 24h); chamadas síncronas do yfinance sempre em thread executor (padrão já usado em `yahoo.py::_fetch_quotes_sync`).

### Brapi.dev (free tier)
- Já integrado (`market_data/brapi.py`), token gratuito do usuário em `user_settings.brapi_key`.
- Free tier: quotes B3, histórico, e campos fundamentais básicos com `?fundamental=true` (`priceEarnings`, `earningsPerShare`).
- Módulos avançados (`summaryProfile`, `defaultKeyStatistics`, `financialData`, balanços) **podem exigir plano pago**: a implementação da Fase 2 deve tentá-los e **degradar silenciosamente por campo** se a resposta indicar restrição de plano. Nunca orientar o usuário a assinar plano.

### Banco Central do Brasil (gratuito, sem autenticação)
- **SGS** (Sistema Gerenciador de Séries Temporais): `https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json`
  - CDI diário: série **12**; SELIC meta: série **432**; IPCA mensal: série **433**.
  - Uso: taxas de referência para a engine de renda fixa (`analysis/fixed_income.py`, `calculations.calculate_fixed_income_*`) e benchmark de rentabilidade (ex.: "carteira vs CDI" — candidato a extra futuro).
- **PTAX (Olinda/OData):** cotação oficial USD/BRL — alimenta o worker `fx_updater` existente e a tabela `fx_rates`.
- Implementação sugerida: novo provider leve `market_data/bcb.py` com cache Redis (TTL 12h; séries são diárias/mensais).

### TradingView (gratuito)
- **lightweight-charts** (biblioteca open-source, licença Apache/MIT — sem custo, sem conta): candlestick/volume/overlays na Fase 2. É a opção padrão por dar controle total (tokens de cor, indicadores próprios do backend).
- **Widgets embed gratuitos** (Advanced Chart, Symbol Overview): alternativa de menor esforço documentada — trade-offs: visual excelente e dados próprios da TradingView, mas sem integração com os indicadores calculados no backend, branding TradingView obrigatório e dependência de iframe externo. Usar apenas se o wrapper próprio se mostrar custoso.

### Profit (Nelogica) — DDE
- Fonte **opcional** de cotações em tempo real da B3 para quem tem o Profit instalado (o usuário tem conta). Windows-only → arquitetura de agente local com fallback automático. Spec completa: [`2026-07-12-profit-dde-integration.md`](2026-07-12-profit-dde-integration.md).

---

## Ordem de resolução de cotação (a implementar no factory)

```
Ativo B3:
  1. LocalBridgeProvider (Profit DDE) — se cotação fresca (< 30s) no Redis
  2. Brapi (se brapi_key configurada)
  3. yfinance (ticker + ".SA")

Ativo global:
  1. yfinance
```

O `market_data/factory.py` atual escolhe provider por preferência do usuário; a Fase 2/Bridge evolui para essa cadeia de fallback com verificação de frescor.

---

## Regras de implementação

1. Todo campo vindo de fonte externa é `Optional` no schema Pydantic; a UI trata `null` como "indisponível" (nunca `0` fantasma).
2. Toda chamada externa passa pelo cache Redis com TTL adequado ao dado (quote curto, fundamentos 24h, séries BCB 12h).
3. Falha de uma fonte **nunca** derruba a tela: log + fallback + resposta parcial.
4. Nenhuma chave paga é adicionada a `user_settings`; as existentes (brapi free, chaves LLM do usuário) permanecem.
