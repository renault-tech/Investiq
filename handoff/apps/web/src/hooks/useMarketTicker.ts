import { useQuery } from "@tanstack/react-query";
import { getMarketQuotes, Quote } from "@/lib/market-api";

/** Hook fininho sobre getMarketQuotes (já existe em lib/market-api.ts) —
 * só adiciona o polling da faixa de ticker do TopBar. Nenhuma API nova. */
export function useMarketQuotes(tickers: string[]) {
  return useQuery<Quote[]>({
    queryKey: ["market-ticker", tickers],
    queryFn: () => getMarketQuotes(tickers),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
