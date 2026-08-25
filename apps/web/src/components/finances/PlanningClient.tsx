"use client";

import { useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useForecast } from "@/hooks/useForecast";
import { useCategories } from "@/hooks/useFinance";
import { formatBRLExact, formatBRLCompact } from "@/components/charts/chartTheme";
import { Skeleton } from "@/components/ui/Skeleton";
import { ForecastSection } from "./ForecastSection";
import { BudgetsSection } from "./BudgetsSection";
import type { ForecastMonth } from "@/lib/forecast-api";

const HORIZONS = [3, 6, 12] as const;

function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const label = new Date(year, mon - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  danger,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-4">
      <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
        <Icon size={14} />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-mono text-xl" style={{ color: danger ? "var(--danger)" : "var(--text-primary)" }}>{value}</p>
      {hint && <p className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</p>}
    </div>
  );
}

export function PlanningClient() {
  const [months, setMonths] = useState<(typeof HORIZONS)[number]>(6);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [holder, setHolder] = useState("");
  const { data: categories = [] } = useCategories();
  const { data: forecast, isLoading, isError, refetch } = useForecast(months, accountId, holder || undefined);

  const lastMonth = forecast?.months.at(-1);
  const worstMonth = forecast?.months.reduce<ForecastMonth | undefined>(
    (worst, m) => (!worst || m.balance_realistic < worst.balance_realistic ? m : worst),
    undefined
  );

  return (
    <div className="p-[26px_30px_60px] flex flex-col gap-[18px]">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Planejamento</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : forecast ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Wallet} label="Saldo atual" value={formatBRLExact(forecast.current_balance)} />
          <StatCard
            icon={TrendingUp}
            label={`Projeção realista em ${months}m`}
            value={lastMonth ? formatBRLExact(lastMonth.balance_realistic) : "—"}
            hint={lastMonth ? `Com o certo + estimativa · ${monthLabel(lastMonth.month)}` : undefined}
          />
          <StatCard
            icon={TrendingDown}
            label={`Só o comprometido em ${months}m`}
            value={lastMonth ? formatBRLExact(lastMonth.balance_committed) : "—"}
            hint="Sem contar estimativas"
          />
          <StatCard
            icon={AlertTriangle}
            label="Pior mês projetado"
            value={worstMonth ? formatBRLExact(worstMonth.balance_realistic) : "—"}
            hint={worstMonth ? monthLabel(worstMonth.month) : undefined}
            danger={!!worstMonth && Number(worstMonth.balance_realistic) < 0}
          />
        </div>
      ) : null}

      <ForecastSection
        months={months}
        onMonthsChange={setMonths}
        accountId={accountId}
        onAccountIdChange={setAccountId}
        holder={holder}
        onHolderChange={setHolder}
        forecast={forecast}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
      />

      {forecast && forecast.months.length > 0 && (
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)] overflow-x-auto">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Detalhamento mensal</h2>
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="px-2 py-2 font-medium">Mês</th>
                <th className="px-2 py-2 font-medium text-right">Receita conhecida</th>
                <th className="px-2 py-2 font-medium text-right">Despesa conhecida</th>
                <th className="px-2 py-2 font-medium text-right">Estimativa</th>
                <th className="px-2 py-2 font-medium text-right">Saldo realista</th>
              </tr>
            </thead>
            <tbody>
              {forecast.months.map((m) => (
                <tr key={m.month} className="border-b border-[var(--border)]">
                  <td className="px-2 py-2 text-[var(--text-secondary)] whitespace-nowrap">{monthLabel(m.month)}</td>
                  <td className="px-2 py-2 text-right font-mono text-[var(--accent)] whitespace-nowrap">
                    {formatBRLCompact(Number(m.committed_income))}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[var(--danger)] whitespace-nowrap">
                    {formatBRLCompact(Number(m.committed_expense))}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[var(--text-muted)] whitespace-nowrap">
                    +{formatBRLCompact(Number(m.estimated_income))} / −{formatBRLCompact(Number(m.estimated_expense))}
                  </td>
                  <td
                    className="px-2 py-2 text-right font-mono font-semibold whitespace-nowrap"
                    style={{ color: Number(m.balance_realistic) < 0 ? "var(--danger)" : "var(--text-primary)" }}
                  >
                    {formatBRLExact(Number(m.balance_realistic))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BudgetsSection categories={categories} />
    </div>
  );
}
