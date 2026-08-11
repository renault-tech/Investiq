"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useMarketQuotes } from "@/hooks/useAssetData";
import { Quote } from "@/lib/market-api";

type Kind = "points" | "brl" | "usd";

const INSTRUMENTS: { ticker: string; label: string; kind: Kind }[] = [
  { ticker: "^BVSP", label: "Ibovespa", kind: "points" },
  { ticker: "^GSPC", label: "S&P 500", kind: "points" },
  { ticker: "^IXIC", label: "Nasdaq", kind: "points" },
  { ticker: "^DJI", label: "Dow Jones", kind: "points" },
  { ticker: "USDBRL=X", label: "Dólar", kind: "brl" },
  { ticker: "BTC-USD", label: "Bitcoin", kind: "usd" },
];

function formatValue(value: number, kind: Kind): string {
  if (kind === "brl") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (kind === "usd") return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function InstrumentCard({ label, quote, kind, delay }: { label: string; quote?: Quote; kind: Kind; delay: number }) {
  const positive = (quote?.change_pct ?? 0) >= 0;
  return (
    <div
      className="flex-1 min-w-[150px] border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] px-4 py-3 animate-rise-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="text-[11px] text-[var(--text-secondary)] tracking-[.06em] uppercase">{label}</div>
      {quote ? (
        <>
          <div className="text-[16px] font-semibold mt-1 tabular-nums text-[var(--text-primary)]">
            {formatValue(quote.price, kind)}
          </div>
          <div
            className="flex items-center gap-1 text-[11.5px] mt-0.5"
            style={{ color: quote.change_pct == null ? "var(--text-muted)" : positive ? "var(--accent)" : "var(--danger)" }}
          >
            {quote.change_pct != null && (positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
            {quote.change_pct != null
              ? `${positive ? "+" : ""}${quote.change_pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
              : "—"}
          </div>
        </>
      ) : (
        <div className="h-[38px] flex items-center text-[12px] text-[var(--text-muted)]">indisponível</div>
      )}
    </div>
  );
}

export function MarketOverviewStrip() {
  const tickers = INSTRUMENTS.map((i) => i.ticker);
  const { data: quotes, isLoading } = useMarketQuotes(tickers);
  const byTicker = new Map((quotes ?? []).map((q) => [q.ticker, q]));

  return (
    <div className="flex gap-3 flex-wrap">
      {INSTRUMENTS.map((inst, i) => (
        <InstrumentCard
          key={inst.ticker}
          label={inst.label}
          kind={inst.kind}
          quote={isLoading ? undefined : byTicker.get(inst.ticker)}
          delay={i * 0.03}
        />
      ))}
    </div>
  );
}
