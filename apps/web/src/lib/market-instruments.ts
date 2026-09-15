/** Lista única de instrumentos de mercado disponíveis — mesma fonte usada
 * pelo painel completo do Trader (MarketOverviewStrip, sempre mostra todos)
 * e pela faixa configurável do cabeçalho (TickerStrip, o usuário escolhe um
 * subconjunto). Um só lugar evita as duas listas divergirem com o tempo. */
export type InstrumentKind = "points" | "brl" | "usd";

export interface MarketInstrument {
  ticker: string;
  label: string;
  kind: InstrumentKind;
}

export const MARKET_INSTRUMENTS: MarketInstrument[] = [
  { ticker: "^BVSP", label: "Ibovespa", kind: "points" },
  { ticker: "^GSPC", label: "S&P 500", kind: "points" },
  { ticker: "^IXIC", label: "Nasdaq", kind: "points" },
  { ticker: "^DJI", label: "Dow Jones", kind: "points" },
  { ticker: "USDBRL=X", label: "Dólar", kind: "brl" },
  { ticker: "EURBRL=X", label: "Euro", kind: "brl" },
  { ticker: "BTC-USD", label: "Bitcoin", kind: "usd" },
  { ticker: "GC=F", label: "Ouro", kind: "usd" },
  { ticker: "CL=F", label: "Petróleo (WTI)", kind: "usd" },
];

/** Seleção padrão da faixa do cabeçalho — todos os instrumentos disponíveis;
 * o usuário reduz a lista em Personalizar cotações. */
export const DEFAULT_TICKER_INSTRUMENTS = MARKET_INSTRUMENTS.map((i) => i.ticker);

export function formatInstrumentValue(value: number, kind: InstrumentKind): string {
  if (kind === "brl") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (kind === "usd") return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
