"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { CategoryTrend } from "@/lib/analytics-api";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { formatBRLExact } from "@/components/charts/chartTheme";

const DIRECTION: Record<CategoryTrend["direction"], { tone: BadgeTone; icon: typeof ArrowUp; label: string }> = {
  up: { tone: "negative", icon: ArrowUp, label: "acima do normal" },
  down: { tone: "positive", icon: ArrowDown, label: "abaixo do normal" },
  stable: { tone: "neutral", icon: Minus, label: "normal" },
};

interface Props {
  trends: CategoryTrend[];
}

export function CategoryTrendList({ trends }: Props) {
  // O JSON traz Decimal serializado como string; converte antes de formatar
  // ou comparar, senão "0" > "450" ordena como texto e a formatação passa reto.
  const parsed = trends.map((t) => ({
    ...t,
    current_amount: Number(t.current_amount),
    baseline_median: Number(t.baseline_median),
  }));
  const notable = parsed.filter((t) => t.current_amount > 0 || t.baseline_median > 0);

  if (notable.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] py-6 text-center">Sem gastos suficientes para comparar.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {notable.map((trend) => {
        const { tone, icon: Icon, label } = DIRECTION[trend.direction];
        return (
          <li key={trend.category_id ?? "none"} className="flex items-center gap-3 py-2.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: trend.category_color ?? "#94A3B8" }}
            />
            <span className="flex-1 min-w-0 text-sm text-[var(--text-primary)] truncate">
              {trend.category_name}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono hidden sm:inline">
              mediana {formatBRLExact(trend.baseline_median)}
            </span>
            <span className="font-mono text-sm text-[var(--text-primary)]">
              {formatBRLExact(trend.current_amount)}
            </span>
            <Badge tone={tone} className="gap-1 shrink-0">
              <Icon size={11} /> {label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
