"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { usePortfolioIncome } from "@/hooks/usePortfolioIncome";
import { ChartCard } from "@/components/charts/ChartCard";
import { formatBRL, formatBRLCompact, formatPct } from "@/components/charts/chartTheme";

const INCOME_COLOR = "#059669";
const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatMonth(month: string): string {
  const mon = Number(month.split("-")[1]);
  return MONTH_NAMES[mon - 1];
}

interface IncomeTabProps {
  portfolioId: string;
}

export function IncomeTab({ portfolioId }: IncomeTabProps) {
  const year = new Date().getFullYear();
  const { data, isLoading } = usePortfolioIncome(portfolioId, year);

  const series = (data?.monthly_series ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <p className="text-xs text-[var(--text-muted)]">Total recebido em {year}</p>
          {isLoading ? (
            <div className="h-7 w-28 mt-1 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ) : (
            <p className="text-xl font-semibold font-mono mt-1 text-[var(--accent)]">
              {formatBRL(Number(data?.total ?? 0))}
            </p>
          )}
        </div>
      </div>

      <ChartCard
        title={`Proventos por mês — ${year}`}
        isLoading={isLoading}
        isEmpty={!data || series.every((p) => p.amount === 0)}
        emptyMessage="Nenhum provento recebido neste ano."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
                return (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 shadow-sm text-xs">
                    <p className="font-semibold text-[var(--text-primary)] capitalize">{formatMonth(String(label))}</p>
                    <p className="text-[var(--text-secondary)] font-mono">{formatBRL(Number(payload[0].value))}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="amount" name="Proventos" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
              <th className="px-3 py-2 font-medium">Ativo</th>
              <th className="px-3 py-2 font-medium text-right">Proventos 12m</th>
              <th className="px-3 py-2 font-medium text-right">Yield on cost</th>
            </tr>
          </thead>
          <tbody>
            {(data?.by_asset ?? []).map((asset) => (
              <tr key={asset.ticker} className="border-b border-[var(--border)] last:border-0">
                <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{asset.ticker}</td>
                <td className="px-3 py-2 text-right font-mono text-[var(--text-secondary)]">
                  {formatBRL(Number(asset.total_12m))}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--accent)]">
                  {formatPct(Number(asset.yield_on_cost))}
                </td>
              </tr>
            ))}
            {(!data || data.by_asset.length === 0) && !isLoading && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[var(--text-muted)]">
                  Nenhuma posição com proventos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
