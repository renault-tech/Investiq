import { useQuery } from "@tanstack/react-query";
import {
  getAssetHistory,
  getAssetIndicators,
  getAssetFundamentals,
  HistoryPeriod,
} from "@/lib/market-api";

export function useAssetHistory(ticker: string, period: HistoryPeriod) {
  return useQuery({
    queryKey: ["asset-history", ticker, period],
    queryFn: () => getAssetHistory(ticker, period),
    enabled: !!ticker,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useAssetIndicators(ticker: string, period: HistoryPeriod, enabled: boolean) {
  return useQuery({
    queryKey: ["asset-indicators", ticker, period],
    queryFn: () => getAssetIndicators(ticker, period),
    enabled: !!ticker && enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useAssetFundamentals(ticker: string) {
  return useQuery({
    queryKey: ["asset-fundamentals", ticker],
    queryFn: () => getAssetFundamentals(ticker),
    enabled: !!ticker,
    staleTime: 60 * 60_000,
    retry: 1,
  });
}
