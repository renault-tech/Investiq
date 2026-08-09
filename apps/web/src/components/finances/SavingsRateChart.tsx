"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SavingsPoint } from "@/lib/analytics-api";
import { CATEGORICAL, formatBRL, formatBRLCompact, formatPct } from "@/components/charts/chartTheme";

const INCOME_COLOR = "#059669";
const EXPENSE_COLOR = "#EF4444";
const RATE_COLOR = CATEGORICAL[2];

function formatMonth(month: string): string {
  const [year, mon] = month.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(mon) - 1]}/${year.slice(2)}`;
}

interface Props {
  series: SavingsPoint[];
}

export function SavingsRateChart({ series }: Props) {
  const data = series.map((p) => ({
    ...p,
    income: Number(p.income),
    expense: Number(p.expense),
    savings_rate: p.savings_rate === null ? null : Number(p.savings_rate) * 100,
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              yAxisId="value"
              tickFormatter={(v: number) => formatBRLCompact(v)}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: "var(--border)", opacity: 0.3 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as (typeof data)[number] | undefined;
                if (!point) return null;
                return (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 shadow-sm text-xs space-y-0.5">
                    <p className="font-semibold text-[var(--text-primary)]">{formatMonth(String(label))}</p>
                    <p className="text-[var(--text-secondary)]">
                      Receitas: <span className="font-mono text-[var(--text-primary)]">{formatBRL(point.income)}</span>
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Despesas: <span className="font-mono text-[var(--text-primary)]">{formatBRL(point.expense)}</span>
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Poupança:{" "}
                      <span className="font-mono text-[var(--text-primary)]">
                        {point.savings_rate === null ? "—" : formatPct(point.savings_rate / 100)}
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar yAxisId="value" dataKey="income" name="Receitas" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar yAxisId="value" dataKey="expense" name="Despesas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line
              yAxisId="rate" type="monotone" dataKey="savings_rate" name="Taxa de poupança"
              stroke={RATE_COLOR} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 pt-2 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} /> Receitas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} /> Despesas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ backgroundColor: RATE_COLOR }} /> Taxa de poupança
        </span>
      </div>
    </div>
  );
}
