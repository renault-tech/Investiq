"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowDownCircle, ArrowUpCircle, Flame, Layers, PiggyBank, Timer } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinanceScopeStore } from "@/store/useFinanceScopeStore";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Input";
import { formatBRLExact, formatBRLCompact, formatPct } from "@/components/charts/chartTheme";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { CategoryTrendList } from "./CategoryTrendList";
import { CategoryMatrix } from "./CategoryMatrix";
import { CategoryBars } from "./CategoryBars";
import { formatDecimal } from "@/lib/number-format";
import { buildHolderOptions } from "@/lib/holders";

const SavingsRateChart = dynamic(
  () => import("./SavingsRateChart").then((m) => m.SavingsRateChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

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
  // Mesma carteira ativa de /finances — trocar lá também muda a análise aqui.
  const activeAccountId = useFinanceScopeStore((s) => s.activeAccountId);
  const setActiveAccountId = useFinanceScopeStore((s) => s.setActiveAccountId);
  const [holder, setHolder] = useState("");
  const { data: accounts = [] } = useAccounts();
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const holderOptions = buildHolderOptions(accounts);
  const { data, isLoading, isError, refetch } = useAnalytics(months, activeAccountId, holder || undefined);

  const latestSavingsRate = data?.savings_series.at(-1)?.savings_rate ?? null;
  const periodIncome = data?.savings_series.reduce((sum, m) => sum + Number(m.income), 0) ?? 0;
  const periodExpense = data?.savings_series.reduce((sum, m) => sum + Number(m.expense), 0) ?? 0;

  // Ranking por categoria no período inteiro (soma das colunas do
  // comparativo mês a mês) — reaproveita os mesmos dados já buscados para a
  // matriz, sem precisar de outra chamada à API.
  const topCategories = (data?.category_matrix ?? [])
    .map((row) => ({ ...row, total: row.values.reduce((sum, v) => sum + Number(v), 0) }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  const topCategoriesTotal = Math.max(1, topCategories.reduce((sum, r) => sum + r.total, 0));
  const topCategoriesBars = topCategories.map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    category_color: row.category_color,
    value: row.total,
    pct: row.total / topCategoriesTotal,
  }));

  return (
    <div className="p-[26px_30px_60px] flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Análise financeira</h1>
          {activeAccount && (
            <button
              onClick={() => setActiveAccountId(null)}
              title="Clique para ver o consolidado"
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-colors"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--glow)" }}
            >
              <Layers size={12} /> {activeAccount.name}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {holderOptions.length > 1 && (
            <Select
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              aria-label="Filtrar análise por titular"
              className="!py-1.5 text-xs"
            >
              {holderOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          )}
          <div className="flex rounded-[9px] border border-[var(--border)] overflow-hidden">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setMonths(h)}
                className="px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: months === h ? "var(--surface-3)" : "transparent",
                  color: months === h ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {h} meses
              </button>
            ))}
          </div>
        </div>
      </div>

      {isError && !isLoading ? (
        <ErrorState title="Não foi possível carregar a análise." onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
              value={data.runway_months === null ? "—" : `${formatDecimal(Number(data.runway_months), 1)} meses`}
              hint="saldo consolidado ÷ burn rate"
            />
            <StatCard
              icon={ArrowUpCircle}
              label="Receitas no período"
              value={formatBRLCompact(periodIncome)}
              hint={`${months} meses`}
            />
            <StatCard
              icon={ArrowDownCircle}
              label="Despesas no período"
              value={formatBRLCompact(periodExpense)}
              hint={`${months} meses`}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Tendência por categoria</h2>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                Gasto do mês contra a mediana dos últimos 6 meses fechados.
              </p>
              <CategoryTrendList trends={data.category_trends} />
            </div>

            <div className="min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Maiores categorias</h2>
              <p className="text-xs text-[var(--text-muted)] mb-2">Soma do período de {months} meses.</p>
              <CategoryBars byCategory={topCategoriesBars} />
            </div>

            <div className="min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 lg:col-span-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Comparativo mês a mês</h2>
              <CategoryMatrix months={data.months} rows={data.category_matrix} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
