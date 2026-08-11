"use client";

import { AssetFundamentals } from "@/lib/market-api";
import { formatBRLCompact } from "@/components/charts/chartTheme";

interface FundamentalsGridProps {
  fundamentals?: AssetFundamentals;
  isLoading: boolean;
}

function fmtRatio(value: number | null): string | null {
  if (value === null) return null;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function fmtPctFraction(value: number | null): string | null {
  if (value === null) return null;
  // fontes retornam fração (0.065) — valores > 1 já vieram em %
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function FundamentalsGrid({ fundamentals, isLoading }: FundamentalsGridProps) {
  const cells: { label: string; value: string | null }[] = [
    { label: "P/L", value: fmtRatio(fundamentals?.p_l ?? null) },
    { label: "P/VP", value: fmtRatio(fundamentals?.p_vp ?? null) },
    { label: "Dividend Yield", value: fmtPctFraction(fundamentals?.dividend_yield ?? null) },
    { label: "ROE", value: fmtPctFraction(fundamentals?.roe ?? null) },
    { label: "Margem líquida", value: fmtPctFraction(fundamentals?.net_margin ?? null) },
    { label: "LPA", value: fmtRatio(fundamentals?.lpa ?? null) },
    { label: "VPA", value: fmtRatio(fundamentals?.vpa ?? null) },
    {
      label: "Valor de mercado",
      value: fundamentals?.market_cap != null ? formatBRLCompact(fundamentals.market_cap) : null,
    },
    {
      label: "Máx. 52 sem.",
      value: fundamentals?.week52_high != null ? fmtRatio(fundamentals.week52_high) : null,
    },
    {
      label: "Mín. 52 sem.",
      value: fundamentals?.week52_low != null ? fmtRatio(fundamentals.week52_low) : null,
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Fundamentos</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] p-3"
          >
            <p className="text-xs text-[var(--text-muted)]">{cell.label}</p>
            {isLoading ? (
              <div className="h-5 w-16 mt-1 rounded bg-[var(--surface-2)] animate-pulse" />
            ) : (
              <p className={`text-sm font-mono mt-1 ${cell.value ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                {cell.value ?? "indisponível"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
