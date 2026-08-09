"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ForecastMonth } from "@/lib/forecast-api";
import { CATEGORICAL, formatBRL, formatBRLCompact } from "@/components/charts/chartTheme";

const INCOME_COLOR = "#059669";
const EXPENSE_COLOR = "#EF4444";
const BALANCE_COLOR = CATEGORICAL[0];

function formatMonth(month: string): string {
  const [year, mon] = month.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(mon) - 1]}/${year.slice(2)}`;
}

interface Props {
  months: ForecastMonth[];
  negativeFrom: string | null;
}

export function ForecastChart({ months, negativeFrom }: Props) {
  const data = months.map((m) => ({
    ...m,
    committed_income: Number(m.committed_income),
    committed_expense: Number(m.committed_expense),
    estimated_income: Number(m.estimated_income),
    estimated_expense: Number(m.estimated_expense),
    balance_committed: Number(m.balance_committed),
    balance_realistic: Number(m.balance_realistic),
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
              tickFormatter={(v: number) => formatBRLCompact(v)}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            {negativeFrom && (
              <ReferenceLine
                x={negativeFrom}
                stroke="var(--danger)"
                strokeDasharray="4 3"
                label={{ value: "saldo negativo", position: "insideTopLeft", fontSize: 10, fill: "var(--danger)" }}
              />
            )}
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
                      Receitas conhecidas:{" "}
                      <span className="font-mono text-[var(--text-primary)]">{formatBRL(point.committed_income)}</span>
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Despesas conhecidas:{" "}
                      <span className="font-mono text-[var(--text-primary)]">{formatBRL(point.committed_expense)}</span>
                    </p>
                    {(point.estimated_income > 0 || point.estimated_expense > 0) && (
                      <>
                        <p className="text-[var(--text-secondary)]">
                          Receita estimada:{" "}
                          <span className="font-mono text-[var(--text-primary)]">{formatBRL(point.estimated_income)}</span>
                        </p>
                        <p className="text-[var(--text-secondary)]">
                          Despesa estimada:{" "}
                          <span className="font-mono text-[var(--text-primary)]">{formatBRL(point.estimated_expense)}</span>
                        </p>
                      </>
                    )}
                    <p className="text-[var(--text-secondary)] pt-1 border-t border-[var(--border)] mt-1">
                      Saldo projetado:{" "}
                      <span className="font-mono text-[var(--text-primary)]">{formatBRL(point.balance_realistic)}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="committed_income" stackId="income" name="Receita conhecida" fill={INCOME_COLOR} isAnimationActive={false} />
            <Bar
              dataKey="estimated_income" stackId="income" name="Receita estimada"
              fill={INCOME_COLOR} fillOpacity={0.35} radius={[4, 4, 0, 0]} isAnimationActive={false}
            />
            <Bar dataKey="committed_expense" stackId="expense" name="Despesa conhecida" fill={EXPENSE_COLOR} isAnimationActive={false} />
            <Bar
              dataKey="estimated_expense" stackId="expense" name="Despesa estimada"
              fill={EXPENSE_COLOR} fillOpacity={0.35} radius={[4, 4, 0, 0]} isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="balance_committed" name="Saldo (só o conhecido)"
              stroke={BALANCE_COLOR} strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="balance_realistic" name="Saldo projetado"
              stroke={BALANCE_COLOR} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} /> Receita conhecida
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm opacity-35" style={{ backgroundColor: INCOME_COLOR }} /> Receita estimada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} /> Despesa conhecida
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm opacity-35" style={{ backgroundColor: EXPENSE_COLOR }} /> Despesa estimada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ backgroundColor: BALANCE_COLOR }} /> Saldo projetado
        </span>
      </div>
    </div>
  );
}
