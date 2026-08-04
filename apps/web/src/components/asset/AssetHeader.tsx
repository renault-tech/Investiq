"use client";

import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import { Bar, AssetFundamentals } from "@/lib/market-api";
import { formatBRL } from "@/components/charts/chartTheme";

interface AssetHeaderProps {
  ticker: string;
  bars: Bar[];
  fundamentals?: AssetFundamentals;
  onAnalyze: () => void;
  analyzing: boolean;
}

export function AssetHeader({ ticker, bars, fundamentals, onAnalyze, analyzing }: AssetHeaderProps) {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const changePct = last && prev && prev.close !== 0 ? ((last.close - prev.close) / prev.close) * 100 : null;
  const positive = (changePct ?? 0) >= 0;

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{ticker}</h1>
          {fundamentals?.sector && (
            <span className="text-xs px-2 py-0.5 rounded-md border border-[var(--border)] text-[var(--text-muted)]">
              {fundamentals.sector}
            </span>
          )}
        </div>
        {fundamentals?.name && (
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{fundamentals.name}</p>
        )}
        {last && (
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-semibold font-mono text-[var(--text-primary)]">
              {formatBRL(last.close)}
            </span>
            {changePct !== null && (
              <span
                className={`flex items-center text-sm font-mono ${
                  positive ? "text-[var(--accent)]" : "text-[var(--danger)]"
                }`}
              >
                {positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {changePct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
              </span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onAnalyze}
        disabled={analyzing}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--navy)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed self-start md:self-auto"
      >
        <Sparkles size={16} />
        {analyzing ? "Analisando…" : "Analisar com IA"}
      </button>
    </div>
  );
}
