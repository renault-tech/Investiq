"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { CategorySummary, MonthlyFlowPoint } from "@/lib/finance-api";
import { CATEGORICAL, formatBRL, formatBRLCompact, formatPct } from "@/components/charts/chartTheme";

const INCOME_COLOR = "#059669";
const EXPENSE_COLOR = "#EF4444";
const MAX_SLICES = 6;

// ─── Donut de despesas por categoria ─────────────────────────────────────────

interface ExpensesByCategoryDonutProps {
  byCategory: CategorySummary[];
}

type Slice = { name: string; value: number; pct: number; color: string };

export function ExpensesByCategoryDonut({ byCategory }: ExpensesByCategoryDonutProps) {
  const slices = useMemo<Slice[]>(() => {
    const sorted = [...byCategory].sort((a, b) => Number(b.value) - Number(a.value));
    const head = sorted.slice(0, MAX_SLICES - 1);
    const tail = sorted.slice(MAX_SLICES - 1);
    const result: Slice[] = head.map((c, i) => ({
      name: c.category_name,
      value: Number(c.value),
      pct: Number(c.pct),
      color: c.category_color ?? CATEGORICAL[i],
    }));
    if (tail.length === 1) {
      result.push({
        name: tail[0].category_name,
        value: Number(tail[0].value),
        pct: Number(tail[0].pct),
        color: tail[0].category_color ?? CATEGORICAL[result.length],
      });
    } else if (tail.length > 1) {
      result.push({
        name: "Outros",
        value: tail.reduce((s, c) => s + Number(c.value), 0),
        pct: tail.reduce((s, c) => s + Number(c.pct), 0),
        color: "#94A3B8",
      });
    }
    return result;
  }, [byCategory]);

  return (
    <div className="flex h-full items-center gap-4">
      <div
        className="h-full flex-1 min-w-0"
        role="img"
        aria-label={`Despesas por categoria: ${slices.map((s) => `${s.name} ${formatPct(s.pct)}`).join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={1}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const slice = payload[0].payload as Slice;
                return (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 shadow-sm text-xs">
                    <p className="font-semibold text-[var(--text-primary)]">{slice.name}</p>
                    <p className="text-[var(--text-secondary)] font-mono">
                      {formatBRL(slice.value)} · {formatPct(slice.pct)}
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="shrink-0 space-y-1.5 pr-1 max-h-full overflow-y-auto">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-[var(--text-secondary)]">{slice.name}</span>
            <span className="ml-auto pl-3 font-mono text-[var(--text-primary)]">{formatPct(slice.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Fluxo mensal (12 meses) ─────────────────────────────────────────────────

interface MonthlyFlowChartProps {
  series: MonthlyFlowPoint[];
}

function formatMonth(month: string): string {
  const [year, mon] = month.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(mon) - 1]}/${year.slice(2)}`;
}

export function MonthlyFlowChart({ series }: MonthlyFlowChartProps) {
  const data = series.map((p) => ({
    ...p,
    income: Number(p.income),
    expense: Number(p.expense),
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tickFormatter={(v: number) => formatBRLCompact(v)}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ fill: "var(--border)", opacity: 0.3 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const income = payload.find((p) => p.dataKey === "income")?.value as number;
                const expense = payload.find((p) => p.dataKey === "expense")?.value as number;
                return (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 shadow-sm text-xs space-y-0.5">
                    <p className="font-semibold text-[var(--text-primary)]">{formatMonth(String(label))}</p>
                    <p className="text-[var(--text-secondary)]">
                      Receitas: <span className="font-mono text-[var(--text-primary)]">{formatBRL(income ?? 0)}</span>
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Despesas: <span className="font-mono text-[var(--text-primary)]">{formatBRL(expense ?? 0)}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="income" name="Receitas" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expense" name="Despesas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 pt-2 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} /> Receitas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} /> Despesas
        </span>
      </div>
    </div>
  );
}
