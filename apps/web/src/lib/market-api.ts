import { apiClient } from "./api-client";
import { coerceNumbers, coerceNumbersInList } from "./coerce";

export type HistoryPeriod = "1mo" | "3mo" | "6mo" | "1y" | "5y" | "max";

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AssetHistory {
  ticker: string;
  period: string;
  interval: string;
  bars: Bar[];
}

export interface RsiPoint {
  date: string;
  rsi: number | null;
}

export interface MacdPoint {
  date: string;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface BollingerPoint {
  date: string;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export interface MaSeries {
  period: number;
  points: { date: string; value: number | null }[];
}

export interface AssetIndicators {
  ticker: string;
  rsi: RsiPoint[];
  macd: MacdPoint[];
  bollinger: BollingerPoint[];
  sma: MaSeries[];
  ema: MaSeries[];
}

export interface AssetFundamentals {
  ticker: string;
  name: string | null;
  sector: string | null;
  market_cap: number | null;
  p_l: number | null;
  p_vp: number | null;
  dividend_yield: number | null;
  roe: number | null;
  net_margin: number | null;
  lpa: number | null;
  vpa: number | null;
  revenue_ttm: number | null;
  net_income_ttm: number | null;
  week52_high: number | null;
  week52_low: number | null;
}

// Pydantic serializa Decimal como string — coagir aqui, na fronteira, para os
// componentes poderem confiar nos tipos declarados acima (ver lib/coerce.ts).
// Sem isso, FundamentalsGrid quebra em runtime (String não tem .toLocaleString)
// e o candle chart compara open/close como texto em vez de número.
const BAR_NUMERIC = ["open", "high", "low", "close"] as const;
const FUNDAMENTALS_NUMERIC = [
  "market_cap", "p_l", "p_vp", "dividend_yield", "roe", "net_margin",
  "lpa", "vpa", "revenue_ttm", "net_income_ttm", "week52_high", "week52_low",
] as const;

export async function getAssetHistory(
  ticker: string,
  period: HistoryPeriod = "1y",
  interval: "1d" | "1wk" = "1d"
): Promise<AssetHistory> {
  const res = await apiClient.get<AssetHistory>(`/market/assets/${ticker}/history`, {
    params: { period, interval },
  });
  return { ...res.data, bars: coerceNumbersInList(res.data.bars ?? [], BAR_NUMERIC) };
}

export async function getAssetIndicators(
  ticker: string,
  period: HistoryPeriod = "1y"
): Promise<AssetIndicators> {
  const res = await apiClient.get<AssetIndicators>(`/market/assets/${ticker}/indicators`, {
    params: { period },
  });
  const data = res.data;
  return {
    ...data,
    rsi: coerceNumbersInList(data.rsi ?? [], ["rsi"] as const),
    macd: coerceNumbersInList(data.macd ?? [], ["macd", "signal", "histogram"] as const),
    bollinger: coerceNumbersInList(data.bollinger ?? [], ["upper", "middle", "lower"] as const),
    sma: (data.sma ?? []).map((s) => ({ ...s, points: coerceNumbersInList(s.points ?? [], ["value"] as const) })),
    ema: (data.ema ?? []).map((s) => ({ ...s, points: coerceNumbersInList(s.points ?? [], ["value"] as const) })),
  };
}

export async function getAssetFundamentals(ticker: string): Promise<AssetFundamentals> {
  const res = await apiClient.get<AssetFundamentals>(`/market/assets/${ticker}/fundamentals`);
  return coerceNumbers(res.data, FUNDAMENTALS_NUMERIC);
}

export interface Quote {
  ticker: string;
  price: number;
  currency: string;
  change_pct: number | null;
}

const QUOTE_NUMERIC = ["price", "change_pct"] as const;

/** Cotação em lote — aceita qualquer ticker que o provedor reconheça,
 * incluindo índices (^BVSP, ^GSPC) e câmbio (USDBRL=X), sem exigir que o
 * ticker já exista como Asset cadastrado. */
export async function getMarketQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];
  const res = await apiClient.get<Quote[]>("/market/quotes", {
    params: { tickers: tickers.join(",") },
  });
  return coerceNumbersInList(res.data, QUOTE_NUMERIC);
}

export interface Sparkline {
  ticker: string;
  closes: number[];
}

/** Fechamentos diários recentes por ticker, em lote — o mini-gráfico ao
 * lado do preço na watchlist. */
export async function getSparklines(tickers: string[]): Promise<Sparkline[]> {
  if (tickers.length === 0) return [];
  const res = await apiClient.get<Sparkline[]>("/market/sparklines", {
    params: { tickers: tickers.join(",") },
  });
  return res.data.map((s) => ({ ...s, closes: s.closes.map(Number) }));
}
