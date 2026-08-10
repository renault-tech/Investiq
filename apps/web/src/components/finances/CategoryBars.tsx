"use client";

import type { CategorySummary } from "@/lib/finance-api";
import { formatBRLCompact } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { PieChart } from "lucide-react";

interface Props {
  byCategory: CategorySummary[];
}

/** Barras horizontais de gasto por categoria — usa a mesma cor cadastrada
 * pelo usuário para a categoria quando existe, com um fallback neutro. */
export function CategoryBars({ byCategory }: Props) {
  if (byCategory.length === 0) {
    return <EmptyState icon={PieChart} title="Nenhuma despesa neste mês." />;
  }
  return (
    <div className="flex flex-col gap-3.5">
      {byCategory.slice(0, 8).map((c) => (
        <div key={c.category_id ?? c.category_name}>
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="flex-1 text-[var(--text-primary)] truncate">{c.category_name}</span>
            <span className="text-[var(--text-secondary)] tabular-nums">{formatBRLCompact(Number(c.value))}</span>
          </div>
          <div className="h-[5px] rounded-full bg-[var(--surface-3)] mt-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.min(100, Number(c.pct) * 100)}%`, background: c.category_color ?? "var(--accent)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
