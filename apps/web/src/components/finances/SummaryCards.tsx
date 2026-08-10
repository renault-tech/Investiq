"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { FinanceSummary } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { useAnalytics } from "@/hooks/useAnalytics";

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
    <span className={`flex items-center gap-0.5 text-xs ${good ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
      {value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs mês anterior
    </span>
  );
}

export function SummaryCards({ summary, isLoading }: SummaryCardsProps) {
  const { data: analytics } = useAnalytics(6);
  const savingsSeries = analytics?.savings_series ?? [];
  const lastRate = savingsSeries[savingsSeries.length - 1]?.savings_rate;

  const cards = [
    {
      label: "Receitas · mês",
      value: formatBRLExact(Number(summary?.income ?? 0)),
      sub: <Variation pct={summary?.income_prev_pct ?? null} />,
      color: "var(--accent)",
    },
    {
      label: "Despesas · mês",
      value: formatBRLExact(Number(summary?.expense ?? 0)),
      sub: <Variation pct={summary?.expense_prev_pct ?? null} invert />,
      color: "var(--danger)",
    },
    {
      label: "Sobra",
      value: formatBRLExact(Number(summary?.net ?? 0)),
      sub: <span className="text-xs text-[var(--text-secondary)]">Receitas − despesas do mês</span>,
      color: Number(summary?.net ?? 0) >= 0 ? "var(--accent)" : "var(--danger)",
    },
    {
      label: "Taxa de poupança",
      value: lastRate != null ? `${(Number(lastRate) * 100).toFixed(1)}%` : "—",
      sub: <span className="text-xs text-[var(--text-secondary)]">Últimos meses</span>,
      color: "var(--text-primary)",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[18px]">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] p-5 animate-rise-up"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <p className="text-[11.5px] text-[var(--text-secondary)] tracking-[.06em] uppercase">{card.label}</p>
          {isLoading ? (
            <div className="h-7 w-28 mt-2 rounded bg-[var(--surface-3)] animate-pulse" />
          ) : (
            <>
              <p className="text-2xl font-semibold mt-2 tracking-[-.03em] tabular-nums" style={{ color: card.color }}>
                {card.value}
              </p>
              <div className="mt-1">{card.sub}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
