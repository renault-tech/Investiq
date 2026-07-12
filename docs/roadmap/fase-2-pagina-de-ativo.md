# Fase 2 — Página de análise de ativo individual (técnica + fundamentalista + IA)

**Objetivo:** clicar num ticker abre uma página completa do ativo: candlestick com indicadores técnicos sobrepostos, grid de fundamentos e análise IA contextual. Desorfanizar `analysis/indicators.py` e `analysis/fixed_income.py`.

**Dependências:** Fases 0 e 1 (lib `lightweight-charts` instalada, `lib/sse.ts` criada). **Grão:** 2–3 sessões.

**Restrição:** somente dados gratuitos — Brapi free tier + yfinance, com **degradação por campo**. Ver `../specs/2026-07-12-data-sources-free.md`. O widget gratuito da TradingView é alternativa documentada de menor esforço para o gráfico avançado (decidir na implementação; o plano principal é lightweight-charts, que dá controle total e não depende de embed externo).

---

## Tarefas — Backend

### 2.1 — Novo router de mercado

**Arquivo novo:** `apps/api/src/market_data/router.py` (prefixo `/market`), registrado em `main.py`.
**Arquivo novo:** `apps/api/src/market_data/dependencies.py` — mover para cá o dependency `_get_user_provider_settings` hoje em `portfolio/router.py` (reuso).
**Arquivo novo:** `apps/api/src/market_data/schemas.py` — schemas Pydantic de resposta (OHLCV, indicadores, fundamentos), serializando `Decimal`.

Endpoints:
- `GET /market/assets/{ticker}/history?period=1mo|3mo|6mo|1y|5y|max&interval=1d|1wk` → OHLCV normalizado via `factory.get_provider` + `MarketDataCache.get_historical/set_historical`, respeitando `preferred_provider`/`brapi_key` do usuário.
- `GET /market/assets/{ticker}/indicators?rsi_period=14&...` → chama `analysis.indicators.get_indicator_bundle` sobre os bars do history (mesmo cache). Retorna séries alinhadas por data: SMA/EMA (períodos parametrizáveis), Bollinger (upper/mid/lower), RSI, MACD (macd/signal/histogram).
- `GET /market/assets/{ticker}/fundamentals` → tarefa 2.2.
- Ticker inexistente → 404 com mensagem clara.

### 2.2 — Fundamentos nos providers (free tier apenas)

**Arquivos:** `apps/api/src/market_data/base.py`, `brapi.py`, `yahoo.py`, `cache.py`

- Novo método na interface: `get_fundamentals(ticker) -> Optional[Fundamentals]`.
- Dataclass `Fundamentals` com **todos os campos `Optional`**: `name, sector, market_cap, p_l, p_vp, dividend_yield, roe, net_margin, lpa, vpa, revenue_ttm, net_income_ttm, week52_high, week52_low`.
- **Brapi:** `GET /api/quote/{ticker}?fundamental=true` — usar apenas o que o **free tier** retorna (`priceEarnings`, `earningsPerShare` e campos do quote). Módulos extras (`summaryProfile`, `defaultKeyStatistics`, `financialData`) devem ser tentados mas tratados como opcionais — se a resposta indicar restrição de plano, ignorar silenciosamente. **Nunca exigir plano pago.**
- **Yahoo:** `yf.Ticker(ticker).get_info()` rodado em thread executor (mesmo padrão de `_fetch_quotes_sync`), mapeando `trailingPE`, `priceToBook`, `dividendYield`, `returnOnEquity`, `profitMargins`, `marketCap`, `fiftyTwoWeekHigh/Low` etc.
- Estratégia de merge: para B3, Brapi primeiro e yfinance (`ticker.SA`) preenchendo lacunas; global, só yfinance.
- Cache Redis novo em `cache.py`: chave `fundamentals:{ticker}`, TTL 24h.

### 2.3 — Projeção de renda fixa

`GET /portfolios/positions/{id}/fixed-income-projection` (em `portfolio/router.py`): para posições de renda fixa, expõe `analysis/fixed_income.py` + `calculations.calculate_fixed_income_net_return` — curva projetada bruta/líquida com IR regressivo e isenções LCI/LCA. Taxas de referência (CDI/SELIC) via API SGS do Banco Central (gratuita — ver spec de data sources).

---

## Tarefas — Frontend

### 2.4 — Rota e componentes

**Rota nova:** `apps/web/src/app/(platform)/investments/[ticker]/page.tsx` → `apps/web/src/components/asset/AssetClient.tsx`.

**Componentes em `apps/web/src/components/asset/`:**
- `AssetHeader.tsx` — nome, ticker, preço atual, variação do dia (cor `--accent`/`--danger`), badge de tipo (ação/FII/ETF/renda fixa), botão "Analisar com IA".
- `CandlestickChart.tsx` — wrapper imperativo de lightweight-charts v5:
  - série candlestick + volume (histograma em pane inferior);
  - overlays SMA/EMA/Bollinger como line series, ligados/desligados por `IndicatorToggle`;
  - RSI e MACD em panes separados (v5 tem panes nativos; se a versão instalada não suportar, dois charts sincronizados via `timeScale().subscribeVisibleLogicalRangeChange`);
  - seletor de período/intervalo; cores dos tokens; resize observer.
- `IndicatorToggle.tsx` — checkboxes/chips para SMA(20/50/200), EMA, Bollinger, RSI, MACD.
- `FundamentalsGrid.tsx` — cards de P/L, P/VP, DY, ROE, margem, market cap, 52w… com estado **"indisponível"** por campo (dado free tier).
- `AssetAiPanel.tsx` — análise IA do ativo: reutiliza `streamAnalysis` (`lib/sse.ts`), prompt inclui fundamentos + últimos valores dos indicadores; chat de follow-up igual ao `/analysis`.

### 2.5 — Integrações

- `PositionsTable.tsx`: célula do ticker vira `<Link href={`/investments/${ticker}`}>`.
- Novos: `apps/web/src/lib/market-api.ts`; hooks `useAssetHistory.ts`, `useAssetIndicators.ts`, `useAssetFundamentals.ts`.
- Busca global do TopBar (Fase 5) navegará para esta rota.

---

## Critérios de verificação

- [ ] `/investments/PETR4` (Brapi/B3) e `/investments/AAPL` (Yahoo): candles de 1 ano renderizam; ligar Bollinger/SMA sobrepõe corretamente; RSI/MACD aparecem em panes.
- [ ] `curl /api/v1/market/assets/PETR4/indicators` → RSI dos últimos pontos ∈ [0,100]; MACD com 3 séries.
- [ ] `curl /api/v1/market/assets/PETR4/fundamentals` → P/L coerente; campos indisponíveis vêm `null` e a UI mostra "indisponível" (sem quebrar).
- [ ] Ticker inexistente → página de erro amigável (404), não crash.
- [ ] Análise IA do ativo cita dados reais (fundamentos/indicadores injetados no prompt).
- [ ] Segunda visita ao ativo em <24h não refaz chamada de fundamentos (cache Redis).
- [ ] Dark/light e mobile ok (gráfico ocupa largura total, toolbar colapsa).
