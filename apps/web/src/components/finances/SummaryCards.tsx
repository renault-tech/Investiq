"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { FinanceSummary } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";

interface SummaryCardsProps {
  summary?: FinanceSummary;
  isLoading: boolean;
}

function Variation({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null;
  const value = pct * 100;
  // para despesas, subir é ruim (invert)
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-mono ${
        good ? "text-[var(--accent)]" : "text-[var(--danger)]"
      }`}
    >
      {value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs mês anterior
    </span>
  );
}

export function SummaryCards({ summary, isLoading }: SummaryCardsProps) {
  const cards = [
    {
      label: "Receitas",
      value: summary?.income ?? 0,
      variation: <Variation pct={summary?.income_prev_pct ?? null} />,
      color: "text-[var(--accent)]",
    },
    {
      label: "Despesas",
      value: summary?.expense ?? 0,
      variation: <Variation pct={summary?.expense_prev_pct ?? null} invert />,
      color: "text-[var(--danger)]",
    },
    {
      label: "Saldo do mês",
      value: summary?.net ?? 0,
      variation: null,
      color: (summary?.net ?? 0) >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 shadow-sm dark:shadow-none"
        >
          <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
          {isLoading ? (
            <div className="h-7 w-28 mt-1 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ) : (
            <>
              <p className={`text-xl font-semibold font-mono mt-1 ${card.color}`}>
                {formatBRLExact(Number(card.value))}
              </p>
              {card.variation}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
