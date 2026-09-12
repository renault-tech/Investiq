"use client";

import { useQueries } from "@tanstack/react-query";
import { getPortfolioIncome, type MonthlyIncomePoint } from "@/lib/income-api";
import { usePortfolioIncome } from "@/hooks/usePortfolioIncome";
import type { Portfolio } from "@/lib/portfolio-api";
import { formatBRLCompact, formatBRLExact } from "@/components/charts/chartTheme";
import { formatPercent } from "@/lib/number-format";
import { useMask } from "@/hooks/useMask";

interface PassiveIncomeCardProps {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  isConsolidated: boolean;
  marketValue: number;
}

/** "Renda passiva" — proventos realizados nos últimos 12 meses (não uma
 * projeção futura: o backend não guarda calendário de pagamento por ativo,
 * só o total já pago por mês, via GET /portfolios/{id}/income). Rotulado
 * como "últimos 12 meses" em vez de "próximos", que seria inventar dado. */
export function PassiveIncomeCard({ portfolios, activePortfolioId, isConsolidated, marketValue }: PassiveIncomeCardProps) {
  const year = new Date().getFullYear();
  const mask = useMask();

  const singleIncome = usePortfolioIncome(!isConsolidated ? activePortfolioId : null, year);
  const consolidatedQueries = useQueries({
    queries: isConsolidated
      ? portfolios.map((p) => ({
          queryKey: ["portfolio-income", p.id, year],
          queryFn: () => getPortfolioIncome(p.id, year),
          staleTime: 60_000,
        }))
      : [],
  });

  let total = 0;
  const byMonth = new Map<string, number>();
  if (isConsolidated) {
    for (const q of consolidatedQueries) {
      if (!q.data) continue;
      total += q.data.total;
      for (const point of q.data.monthly_series) {
        byMonth.set(point.month, (byMonth.get(point.month) ?? 0) + point.amount);
      }
    }
  } else if (singleIncome.data) {
    total = singleIncome.data.total;
    for (const point of singleIncome.data.monthly_series) byMonth.set(point.month, point.amount);
  }

  const series: MonthlyIncomePoint[] = Array.from(byMonth.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const max = Math.max(1, ...series.map((s) => s.amount));
  const dy = marketValue > 0 ? (total / marketValue) * 100 : 0;

  const isLoading = isConsolidated ? consolidatedQueries.some((q) => q.isLoading) : singleIncome.isLoading;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-[var(--text-primary)]">Renda passiva</div>
        <span className="text-base font-semibold tabular-nums text-[var(--text-primary)]">{mask(formatBRLExact(total))}</span>
      </div>
      <div className="text-[11px] text-[var(--text-secondary)] mb-3">
        Últimos 12 meses · DY {formatPercent(dy, 1)}
      </div>
      {isLoading ? (
        <div className="h-16 rounded bg-[var(--surface-3)] animate-pulse" />
      ) : series.length === 0 ? (
        <p className="text-[12px] text-[var(--text-muted)]">Sem proventos registrados ainda.</p>
      ) : (
        <div className="flex items-end gap-1" style={{ height: 64 }}>
          {series.map((s) => (
            <div key={s.month} className="flex-1 h-full flex flex-col justify-end items-center gap-1" title={`${s.month}: ${formatBRLExact(s.amount)}`}>
              <div
                className="w-full rounded-t-[2px]"
                style={{ height: `${Math.max(4, (s.amount / max) * 100)}%`, background: "linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 30%,transparent))" }}
              />
              <span className="font-mono text-[8px] text-[var(--text-muted)]">{s.month.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10.5px] text-[var(--text-muted)] mt-2">{mask(formatBRLCompact(total))} em {series.length} meses com proventos</div>
    </div>
  );
}
