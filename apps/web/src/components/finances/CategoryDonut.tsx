"use client";

import type { CategorySummary } from "@/lib/finance-api";
import { formatBRLCompact, CATEGORICAL } from "@/components/charts/chartTheme";

interface CategoryDonutProps {
  byCategory: CategorySummary[];
  totalLabel: string;
}

/** Alternativa visual em donut ao lado de `CategoryBars` (lista) — usada só
 * na Visão Geral/Finanças. `CategoryBars` continua servindo Relatórios e
 * Transações, que preferem lista longa a donut. */
export function CategoryDonut({ byCategory, totalLabel }: CategoryDonutProps) {
  const top = byCategory.slice(0, 6);
  let acc = 0;
  const stops = top.map((c, i) => {
    const pct = Number(c.pct) * 100;
    const from = acc; acc += pct;
    return `${c.category_color ?? CATEGORICAL[i % CATEGORICAL.length]} ${from}% ${acc}%`;
  }).join(", ");
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 92, height: 92, borderRadius: "50%", background: `conic-gradient(${stops}, var(--border) ${acc}% 100%)` }}>
        <div className="absolute inset-[13px] rounded-full flex items-center justify-center" style={{ background: "var(--background)" }}>
          <div className="text-center">
            <div className="font-mono text-[13px] text-[var(--text-primary)]">{totalLabel}</div>
            <div className="text-[9px] text-[var(--text-muted)]">GASTO</div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {top.map((c, i) => (
          <div key={c.category_id ?? c.category_name} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-[7px] h-[7px] rounded-[2px] flex-shrink-0" style={{ background: c.category_color ?? CATEGORICAL[i % CATEGORICAL.length] }} />
            <span className="flex-1 min-w-0 truncate text-[var(--text-secondary)]">{c.category_name}</span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">{formatBRLCompact(Number(c.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
