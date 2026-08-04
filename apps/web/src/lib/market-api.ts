import { apiClient } from "./api-client";

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

export async function getAssetHistory(
  ticker: string,
  period: HistoryPeriod = "1y",
  interval: "1d" | "1wk" = "1d"
): Promise<AssetHistory> {
  const res = await apiClient.get<AssetHistory>(`/market/assets/${ticker}/history`, {
    params: { period, interval },
  });
  return res.data;
}

export async function getAssetIndicators(
  ticker: string,
  period: HistoryPeriod = "1y"
): Promise<AssetIndicators> {
  const res = await apiClient.get<AssetIndicators>(`/market/assets/${ticker}/indicators`, {
    params: { period },
  });
  return res.data;
}

export async function getAssetFundamentals(ticker: string): Promise<AssetFundamentals> {
  const res = await apiClient.get<AssetFundamentals>(`/market/assets/${ticker}/fundamentals`);
  return res.data;
}
