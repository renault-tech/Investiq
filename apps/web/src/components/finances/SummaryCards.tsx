"use client";

import { FinanceSummary } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { useBudgets } from "@/hooks/useBudgets";
import { useMask } from "@/hooks/useMask";
import { projectMonthlyPct } from "@/lib/budget-projection";

interface SummaryCardsProps {
  summary?: FinanceSummary;
  isLoading: boolean;
  /** Sem o cartão próprio (borda/gradiente/padding) — para quando o pai já
   *  embrulha isto num DashboardCard da grade ajustável (Finanças). */
  bare?: boolean;
}

export function SummaryCards({ summary, isLoading, bare = false }: SummaryCardsProps) {
  const { data: budgets = [] } = useBudgets();
  const mask = useMask();

  const expense = Number(summary?.expense ?? 0);
  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const budgetPct = totalBudget > 0 ? (expense / totalBudget) * 100 : null;
  const projectedPct = projectMonthlyPct(expense, totalBudget);

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const perDay = dayOfMonth > 0 ? expense / dayOfMonth : 0;

  const wrapClass = bare ? "" : "border border-[var(--border)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)]";
  const wrapStyle = bare ? undefined : { background: "linear-gradient(180deg,var(--t4),var(--t1))" };

  if (isLoading) {
    return (
      <div className={`${wrapClass} animate-rise-up`} style={wrapStyle}>
        <div className="h-4 w-24 rounded bg-[var(--surface-3)] animate-pulse" />
        <div className="h-9 w-40 mt-3 rounded bg-[var(--surface-3)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`${wrapClass} animate-rise-up`} style={wrapStyle}>
      <p className="text-[11.5px] text-[var(--text-secondary)]">
        Gasto no mês · {now.toLocaleDateString("pt-BR", { month: "long" })}
      </p>
      <div className="flex items-baseline gap-2.5 mt-2 flex-wrap">
        <span className="font-mono font-medium text-[clamp(24px,2.7vw,33px)] tracking-[-.035em] text-[var(--text-primary)] whitespace-nowrap">
          {mask(formatBRLExact(expense))}
        </span>
        {totalBudget > 0 && (
          <span className="text-[11.5px] text-[var(--text-secondary)]">de {mask(formatBRLExact(totalBudget))}</span>
        )}
      </div>
      {totalBudget > 0 && (
        <>
          <div className="h-[9px] rounded-full overflow-hidden mt-4" style={{ background: "var(--border)" }}>
            <div className="h-full" style={{ width: `${Math.min(100, budgetPct ?? 0)}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-2))" }} />
          </div>
          <div className="flex justify-between text-[10.5px] text-[var(--text-secondary)] mt-2">
            <span>
              {Math.round(budgetPct ?? 0)}% usado · dia {dayOfMonth} de {daysInMonth}
            </span>
            {projectedPct !== null && (
              <span style={{ color: projectedPct > 100 ? "var(--warning)" : "var(--text-secondary)" }}>
                projeção {Math.round(projectedPct)}%
              </span>
            )}
          </div>
        </>
      )}
      <div className="flex gap-3.5 flex-wrap mt-4 pt-3.5 border-t border-[var(--border)]">
        <div className="flex-1 min-w-[96px]">
          <div className="text-[10.5px] text-[var(--text-secondary)]">Entrou</div>
          <div className="font-mono text-base mt-0.5" style={{ color: "var(--accent)" }}>{mask(formatBRLExact(Number(summary?.income ?? 0)))}</div>
        </div>
        <div className="flex-1 min-w-[96px]">
          <div className="text-[10.5px] text-[var(--text-secondary)]">Sobrou</div>
          <div className="font-mono text-base mt-0.5" style={{ color: Number(summary?.net ?? 0) >= 0 ? "var(--text-primary)" : "var(--danger)" }}>
            {mask(formatBRLExact(Number(summary?.net ?? 0)))}
          </div>
        </div>
        <div className="flex-1 min-w-[96px]">
          <div className="text-[10.5px] text-[var(--text-secondary)]">Por dia</div>
          <div className="font-mono text-base mt-0.5 text-[var(--text-primary)]">{mask(formatBRLExact(perDay))}</div>
        </div>
      </div>
    </div>
  );
}
