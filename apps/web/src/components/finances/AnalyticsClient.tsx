"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, PiggyBank, Timer } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatBRLExact, formatPct } from "@/components/charts/chartTheme";
import { SavingsRateChart } from "./SavingsRateChart";
import { CategoryTrendList } from "./CategoryTrendList";
import { CategoryMatrix } from "./CategoryMatrix";

const HORIZONS = [3, 6, 12] as const;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
        <Icon size={14} />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-mono text-xl text-[var(--text-primary)]">{value}</p>
      {hint && <p className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</p>}
    </div>
  );
}

export function AnalyticsClient() {
  const [months, setMonths] = useState<(typeof HORIZONS)[number]>(6);
  const { data, isLoading, isError, refetch } = useAnalytics(months);

  const latestSavingsRate = data?.savings_series.at(-1)?.savings_rate ?? null;

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-4">
      <Link
        href="/finances"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft size={15} /> Finanças
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Análise financeira</h1>
        <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => setMonths(h)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                months === h
                  ? "bg-[var(--navy)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {h} meses
            </button>
          ))}
        </div>
      </div>

      {isError && !isLoading ? (
        <ErrorState title="Não foi possível carregar a análise." onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon={Flame}
              label="Burn rate"
              value={formatBRLExact(Number(data.burn_rate))}
              hint="despesa média dos últimos 3 meses fechados"
            />
            <StatCard
              icon={PiggyBank}
              label="Taxa de poupança"
              value={latestSavingsRate === null ? "—" : formatPct(Number(latestSavingsRate))}
              hint="do mês corrente"
            />
            <StatCard
              icon={Timer}
              label="Fôlego"
              value={data.runway_months === null ? "—" : `${Number(data.runway_months).toFixed(1)} meses`}
              hint="saldo consolidado ÷ burn rate"
            />
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Receitas, despesas e taxa de poupança
            </h2>
            <div style={{ height: 280 }}>
              <SavingsRateChart series={data.savings_series} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Tendência por categoria</h2>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                Gasto do mês contra a mediana dos últimos 6 meses fechados.
              </p>
              <CategoryTrendList trends={data.category_trends} />
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Comparativo mês a mês</h2>
              <CategoryMatrix months={data.months} rows={data.category_matrix} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
