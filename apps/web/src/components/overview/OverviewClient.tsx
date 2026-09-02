"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueries } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Landmark, Target as TargetIcon, ArrowLeftRight, Layers, Wallet, TrendingUp } from "lucide-react";
import {
  listPortfolios,
  getPortfolioSummary,
  getPortfolioPerformance,
  type Portfolio,
  type PortfolioSummary,
  type PerformancePoint,
  type PerformancePeriod,
} from "@/lib/portfolio-api";
import { listInvoices, type CardInvoice } from "@/lib/cards-api";
import { useAccounts } from "@/hooks/useAccounts";
import { ACCOUNT_TYPE_LABELS } from "@/lib/accounts-api";
import { useCards } from "@/hooks/useCards";
import { useGoals } from "@/hooks/useGoals";
import { useTransactions, useFinanceSummary } from "@/hooks/useFinance";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useShallow } from "zustand/react/shallow";
import { useUIStore, type Period, maskValue } from "@/store/useUIStore";
import { assetTypeLabel, formatBRLExact, formatBRLCompact, CATEGORICAL } from "@/components/charts/chartTheme";
import { AreaLineChart } from "@/components/charts/AreaLineChart";
import { DonutRing } from "@/components/charts/DonutRing";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { formatDecimal, formatPercent } from "@/lib/number-format";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { useDashboardLayout, type DashboardCardSpec } from "@/hooks/useDashboardLayout";

const PERIOD_MAP: Record<Period, PerformancePeriod> = { "1M": "1m", "6M": "6m", "1A": "1y", Tudo: "max" };

// Cards fixos do painel. Cada conta e cada carteira de investimento entra
// como um card próprio depois destes (ver `cardSpecs`), em vez da lista
// única e rolável de antes: numa lista com altura fixa, conta que passasse
// do fim ficava invisível sem nenhum indício de que existia.
const BASE_CARDS: DashboardCardSpec[] = [
  { id: "net", label: "Patrimônio", defaultSpan: 8, minSpan: 6 },
  { id: "alloc", label: "Alocação", defaultSpan: 4, minSpan: 3 },
  { id: "flow", label: "Fluxo de caixa", defaultSpan: 5, minSpan: 4 },
  { id: "bill", label: "Fatura", defaultSpan: 3, minSpan: 3 },
  { id: "goals", label: "Metas", defaultSpan: 4, minSpan: 3 },
  { id: "tx", label: "Movimentações", defaultSpan: 8, minSpan: 6 },
  { id: "health", label: "Saúde financeira", defaultSpan: 4, minSpan: 3 },
];
const LEGACY_STORAGE_KEY = "investiq-overview-layout";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Uma "carteira" (conta ou portfólio) tem sua própria série de snapshots;
// somar por data reconstrói a evolução do patrimônio consolidado sem exigir
// que todas as carteiras tenham o mesmo histórico (uma criada depois só
// entra a partir da data em que passou a existir).
function mergePerformanceSeries(seriesList: PerformancePoint[][]): PerformancePoint[] {
  if (seriesList.length <= 1) return seriesList[0] ?? [];
  const byDate = new Map<string, { total_value: number; total_invested: number }>();
  for (const series of seriesList) {
    for (const point of series) {
      const acc = byDate.get(point.date) ?? { total_value: 0, total_invested: 0 };
      acc.total_value += Number(point.total_value);
      acc.total_invested += Number(point.total_invested);
      byDate.set(point.date, acc);
    }
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, total_value: v.total_value, total_invested: v.total_invested } as PerformancePoint));
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 30) return `${days} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function DeltaPill({ fraction }: { fraction: number | null }) {
  if (fraction === null) return null;
  const positive = fraction >= 0;
  return (
    <div
      className="flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-lg"
      style={{ color: positive ? "var(--accent)" : "var(--danger)", background: "var(--glow)" }}
    >
      {positive ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
      {Math.abs(fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </div>
  );
}

export function OverviewClient() {
  const { period, privacy, customize } = useUIStore(
    useShallow((s) => ({ period: s.period, privacy: s.privacy, customize: s.customize }))
  );
  const perfPeriod = PERIOD_MAP[period];

  // ── Dados ────────────────────────────────────────────────────────────────
  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"], queryFn: listPortfolios, staleTime: 30_000,
  });
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();

  // Titular selecionado ("" = todos) — filtra contas e carteiras de
  // investimento juntas, igual ao filtro de Finanças, mas aqui escopando o
  // patrimônio consolidado da Visão Geral inteira.
  const holders = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => a.holder && set.add(a.holder));
    portfolios.forEach((p) => p.holder && set.add(p.holder));
    return Array.from(set).sort();
  }, [accounts, portfolios]);
  const [holder, setHolder] = useState("");
  useEffect(() => {
    if (holder && !holders.includes(holder)) setHolder("");
  }, [holder, holders]);

  const visibleAccounts = holder ? accounts.filter((a) => a.holder === holder) : accounts;
  const visiblePortfolios = holder ? portfolios.filter((p) => p.holder === holder) : portfolios;

  // Uma conta ou carteira vira um card com id estável ("acc-<uuid>"), então
  // a posição e a largura que o usuário escolher para ela sobrevivem a
  // recarregar a página e a criar outras contas.
  const cardSpecs = useMemo<DashboardCardSpec[]>(
    () =>
      BASE_CARDS.concat(
        visibleAccounts.map((a) => ({ id: `acc-${a.id}`, label: a.name, defaultSpan: 3, minSpan: 3 })),
        visiblePortfolios.map((p) => ({ id: `pf-${p.id}`, label: p.name, defaultSpan: 3, minSpan: 3 }))
      ),
    [visibleAccounts, visiblePortfolios]
  );

  const layout = useDashboardLayout("overview", cardSpecs, LEGACY_STORAGE_KEY);

  // Antes só a carteira padrão (ou a primeira) entrava no patrimônio — quem
  // tinha mais de uma carteira de investimento via o resto sumir da conta.
  // Somar o resumo de cada carteira visível cobre todas elas de uma vez.
  const summaryQueries = useQueries({
    queries: visiblePortfolios.map((p) => ({
      queryKey: ["portfolio-summary", p.id],
      queryFn: () => getPortfolioSummary(p.id),
      staleTime: 20_000,
    })),
  });
  const summaries = summaryQueries.map((q) => q.data).filter((d): d is PortfolioSummary => !!d);
  const investmentsLoading = portfoliosLoading || summaryQueries.some((q) => q.isLoading);

  const performanceQueries = useQueries({
    queries: visiblePortfolios.map((p) => ({
      queryKey: ["portfolio-performance", p.id, perfPeriod],
      queryFn: () => getPortfolioPerformance(p.id, perfPeriod),
      staleTime: 60_000,
    })),
  });
  const performance = mergePerformanceSeries(performanceQueries.map((q) => q.data ?? []));

  const { data: cards = [], isLoading: cardsLoading } = useCards();
  const { data: goals = [] } = useGoals();
  const { data: txPage } = useTransactions({ per_page: 6, page: 1, holder: holder || undefined });
  const { data: finSummary } = useFinanceSummary(currentMonth(), undefined, holder || undefined);
  const { data: analytics } = useAnalytics(6, undefined, holder || undefined);

  const billCards = cards.filter((c) => c.is_active).slice(0, 3);
  const invoiceQueries = useQueries({
    queries: billCards.map((c) => ({
      queryKey: ["cards", c.id, "invoices"],
      queryFn: () => listInvoices(c.id),
      staleTime: 60_000,
    })),
  });
  const latestInvoices: (CardInvoice | undefined)[] = invoiceQueries.map((q) =>
    (q.data ?? []).slice().sort((a, b) => b.reference_month.localeCompare(a.reference_month))[0]
  );
  const billTotal = latestInvoices.reduce((sum, inv) => sum + Number(inv?.total_amount ?? 0), 0);
  const billLimitTotal = billCards.reduce((sum, c) => sum + Number(c.credit_limit ?? 0), 0);
  const hasAnyInvoice = latestInvoices.some(Boolean);

  const liquid = visibleAccounts.filter((a) => a.include_in_total).reduce((sum, a) => sum + Number(a.balance), 0);
  const invested = summaries.reduce((sum, s) => sum + Number(s.total_market_value_brl), 0);
  const netWorth = liquid + invested - billTotal;
  const netWorthLoading = accountsLoading || cardsLoading || investmentsLoading;

  const perfValues = performance.map((p) => Number(p.total_value));
  const netDeltaFraction = perfValues.length >= 2 && perfValues[0] !== 0
    ? (perfValues[perfValues.length - 1] - perfValues[0]) / Math.abs(perfValues[0])
    : null;
  const axisLabels = performance.length > 0
    ? performance.filter((_, i) => i % Math.max(1, Math.floor(performance.length / 5)) === 0 || i === performance.length - 1)
        .slice(-6)
        .map((p) => new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }))
    : [];

  // Aloca por tipo de ativo somando o valor de mercado de cada carteira
  // visível — antes só a carteira padrão contava, então quem dividia os
  // investimentos em mais de um portfólio via uma alocação incompleta.
  const allocationByType = new Map<string, number>();
  for (const s of summaries) {
    for (const a of s.allocation_by_type ?? []) {
      allocationByType.set(a.asset_type, (allocationByType.get(a.asset_type) ?? 0) + Number(a.value));
    }
  }
  const allocationTotal = Array.from(allocationByType.values()).reduce((a, b) => a + b, 0);
  const allocation = Array.from(allocationByType.entries())
    .map(([asset_type, value]) => ({ asset_type, value, weight: allocationTotal > 0 ? value / allocationTotal : 0 }))
    .sort((a, b) => b.value - a.value);

  const flowSeries = (finSummary?.monthly_series ?? []).map((m) => ({ ...m, income: Number(m.income), expense: Number(m.expense) })).slice(-6);
  const flowMax = Math.max(1, ...flowSeries.flatMap((m) => [m.income, m.expense]));

  const savingsSeries = analytics?.savings_series ?? [];
  const lastSavingsRaw = savingsSeries[savingsSeries.length - 1];
  const lastSavings = lastSavingsRaw ? { ...lastSavingsRaw, savings_rate: lastSavingsRaw.savings_rate != null ? Number(lastSavingsRaw.savings_rate) : null } : undefined;
  const savingsFraction = lastSavings?.savings_rate ?? 0;
  const runwayMonths = analytics?.runway_months != null ? Number(analytics.runway_months) : null;
  const burnRate = Number(analytics?.burn_rate ?? 0);
  const investedCost = summaries.reduce((sum, s) => sum + Number(s.total_invested_brl), 0);
  const investedPnlAbs = summaries.reduce((sum, s) => sum + Number(s.total_pnl_absolute), 0);
  const totalPnlPercent = investedCost > 0 ? (investedPnlAbs / investedCost) * 100 : 0;
  const financeNet = Number(finSummary?.net ?? 0);

  const mask = (text: string) => maskValue(text, privacy);
  const visible = (id: string) => !layout.isHidden(id);

  const widgetProps = (id: string, delay: number) => ({
    id,
    label: layout.specById[id]?.label ?? id,
    customize,
    span: layout.spanOf(id),
    minSpan: layout.specById[id]?.minSpan,
    dragged: layout.dragged,
    onDragStart: layout.handleDragStart,
    onDrop: layout.handleDrop,
    onHide: layout.hide,
    onSpanChange: layout.setSpan,
    order: layout.order.indexOf(id),
    delay,
  });

  return (
    <div>
      <OnboardingChecklist />
      {holders.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          {holder && (
            <button
              onClick={() => setHolder("")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg border transition-colors"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--glow)" }}
            >
              <Layers size={12} /> Ver consolidado
            </button>
          )}
          <select
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            aria-label="Filtrar por titular"
            className="px-2.5 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-secondary)]"
          >
            <option value="">Todos os titulares</option>
            {holders.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
      )}
      {customize && (
        <div className="flex items-center gap-3 flex-wrap px-4 py-3 border border-dashed border-[var(--accent)] rounded-2xl bg-[var(--glow)] mb-5 animate-rise-up">
          <span className="text-[12.5px] font-medium text-[var(--text-primary)]">
            Modo edição — arraste para reposicionar, use ¼ ½ ⅔ 1 para redimensionar e × para ocultar.
          </span>
          {layout.hiddenCards.map((card) => (
            <button
              key={card.id}
              onClick={() => layout.restore(card.id)}
              className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-secondary)]"
            >
              + {card.label}
            </button>
          ))}
          <button
            onClick={layout.reset}
            className="ml-auto text-[11.5px] px-2.5 py-1.5 rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)]"
          >
            Restaurar padrão
          </button>
        </div>
      )}

      <div className="responsive-grid-12 grid gap-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>

        {/* Patrimônio líquido */}
        {visible("net") && (
          <DashboardCard {...widgetProps("net", 0)}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(700px 220px at 12% -10%, var(--glow), transparent 70%)" }} />
            <div className="relative flex items-start gap-5 flex-wrap">
              <div className="flex-1">
                <div className="text-xs text-[var(--text-secondary)] tracking-[.08em] uppercase">Patrimônio líquido</div>
                <div className="flex items-baseline gap-3.5 mt-2">
                  {netWorthLoading ? (
                    <Skeleton className="h-[44px] w-56" />
                  ) : (
                    <div className="text-[44px] font-semibold tracking-[-.045em] tabular-nums whitespace-nowrap text-[var(--text-primary)]">
                      {mask(formatBRLExact(netWorth))}
                    </div>
                  )}
                  {!netWorthLoading && <DeltaPill fraction={netDeltaFraction} />}
                </div>
                <div className="text-[12.5px] text-[var(--text-secondary)] mt-1.5">Contas, investimentos e faturas em aberto</div>
              </div>
              <div className="flex gap-6 pt-1.5 flex-wrap">
                <div>
                  <div className="text-[11.5px] text-[var(--text-secondary)]">Líquido</div>
                  {netWorthLoading ? (
                    <Skeleton className="h-[17px] w-16 mt-1" />
                  ) : (
                    <div className="text-[17px] font-semibold mt-0.5 tabular-nums text-[var(--text-primary)]">{mask(formatBRLCompact(liquid))}</div>
                  )}
                </div>
                <div>
                  <div className="text-[11.5px] text-[var(--text-secondary)]">Investido</div>
                  {netWorthLoading ? (
                    <Skeleton className="h-[17px] w-16 mt-1" />
                  ) : (
                    <div className="text-[17px] font-semibold mt-0.5 tabular-nums text-[var(--text-primary)]">{mask(formatBRLCompact(invested))}</div>
                  )}
                </div>
                <div>
                  <div className="text-[11.5px] text-[var(--text-secondary)]">Passivos</div>
                  {netWorthLoading ? (
                    <Skeleton className="h-[17px] w-16 mt-1" />
                  ) : (
                    <div className="text-[17px] font-semibold mt-0.5 tabular-nums" style={{ color: billTotal > 0 ? "var(--danger)" : "var(--text-primary)" }}>
                      {mask(formatBRLCompact(billTotal))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {perfValues.length >= 2 ? (
              <>
                <AreaLineChart values={perfValues} className="mt-3.5" />
                <div className="flex justify-between px-0.5 pb-1 text-[11px] text-[var(--text-muted)]">
                  {axisLabels.map((l, i) => <span key={i}>{l}</span>)}
                </div>
              </>
            ) : (
              <div className="h-[120px] flex items-center justify-center text-[12.5px] text-[var(--text-muted)]">
                Sem histórico de carteira suficiente ainda para o gráfico.
              </div>
            )}
          </DashboardCard>
        )}

        {/* Alocação */}
        {visible("alloc") && (
          <DashboardCard {...widgetProps("alloc", 0.06)}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Alocação</div>
            </div>
            {investmentsLoading ? (
              <div className="flex items-center gap-5.5 mt-4">
                <Skeleton className="h-[120px] w-[120px] rounded-full flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2.5">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-3.5 w-full" />
                  ))}
                </div>
              </div>
            ) : allocation.length === 0 ? (
              <EmptyState icon={Landmark} title="Sem posições ainda" description="Adicione ativos em Investimentos para ver a alocação." />
            ) : (
              <>
                <div className="flex items-center gap-5.5 mt-4">
                  <DonutRing
                    className="flex-shrink-0"
                    segments={allocation.map((a, i) => ({ fraction: a.weight, color: CATEGORICAL[i % CATEGORICAL.length] }))}
                  />
                  <div className="flex-1 flex flex-col gap-2.5 min-w-0">
                    {allocation.map((a, i) => (
                      <div key={a.asset_type} className="flex items-center gap-2 text-[12.5px]">
                        <span className="w-2 h-2 rounded-[3px] flex-shrink-0" style={{ background: CATEGORICAL[i % CATEGORICAL.length] }} />
                        <span className="flex-1 text-[var(--text-secondary)] truncate">{assetTypeLabel(a.asset_type)}</span>
                        <b className="font-semibold text-[var(--text-primary)]">{formatPercent(a.weight * 100, 0)}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4.5 border-t border-[var(--border)] pt-3.5 flex justify-between text-[12.5px]">
                  <span className="text-[var(--text-secondary)]">Rentabilidade da carteira</span>
                  <b className="font-semibold" style={{ color: totalPnlPercent >= 0 ? "var(--accent)" : "var(--danger)" }}>
                    {formatPercent(totalPnlPercent, 1, { signed: true })}
                  </b>
                </div>
              </>
            )}
          </DashboardCard>
        )}

        {/* Contas e carteiras: um card por conta, na mesma grade dos demais.
            Antes era uma lista rolável dentro de um card só — o que passasse
            da altura fixa ficava invisível. */}
        {visibleAccounts.map((a, i) => visible(`acc-${a.id}`) && (
          <DashboardCard key={`acc-${a.id}`} {...widgetProps(`acc-${a.id}`, 0.09 + i * 0.01)}>
            <Link href="/finances" className="block group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate group-hover:underline">
                    {a.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {ACCOUNT_TYPE_LABELS[a.account_type]}{a.holder ? ` · ${a.holder}` : ""}
                  </div>
                </div>
                <Wallet size={15} className="text-[var(--text-muted)] flex-shrink-0" />
              </div>
              <div
                className="mt-4 text-2xl font-semibold tracking-[-.03em] tabular-nums"
                style={{ color: Number(a.balance) < 0 ? "var(--danger)" : "var(--text-primary)" }}
              >
                {mask(formatBRLExact(Number(a.balance)))}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                {a.include_in_total ? "Entra no patrimônio" : "Fora do patrimônio"}
              </div>
            </Link>
          </DashboardCard>
        ))}

        {visiblePortfolios.map((p, i) => {
          const s = summaries.find((row) => row.portfolio_id === p.id);
          if (!visible(`pf-${p.id}`)) return null;
          const pnl = s ? Number(s.total_pnl_percent) : null;
          return (
            <DashboardCard key={`pf-${p.id}`} {...widgetProps(`pf-${p.id}`, 0.09 + i * 0.01)}>
              <Link href="/investments" className="block group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate group-hover:underline">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Investimentos{p.holder ? ` · ${p.holder}` : ""}
                    </div>
                  </div>
                  <TrendingUp size={15} className="text-[var(--text-muted)] flex-shrink-0" />
                </div>
                <div className="mt-4 text-2xl font-semibold tracking-[-.03em] tabular-nums text-[var(--text-primary)]">
                  {s ? mask(formatBRLExact(Number(s.total_market_value_brl))) : "…"}
                </div>
                {pnl !== null && (
                  <div
                    className="text-[11px] mt-1 tabular-nums"
                    style={{ color: pnl >= 0 ? "var(--accent)" : "var(--danger)" }}
                  >
                    {formatPercent(pnl, 1, { signed: true })} no total
                  </div>
                )}
              </Link>
            </DashboardCard>
          );
        })}

        {/* Fluxo de caixa */}
        {visible("flow") && (
          <DashboardCard {...widgetProps("flow", 0.12)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Fluxo de caixa</div>
                <div className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">Entradas × saídas · {flowSeries.length} meses</div>
              </div>
              <div className="flex gap-3 text-[11px] text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5"><i className="w-[7px] h-[7px] rounded-[2px] block" style={{ background: "var(--accent)" }} />Entradas</span>
                <span className="flex items-center gap-1.5"><i className="w-[7px] h-[7px] rounded-[2px] block" style={{ background: "var(--surface-3)" }} />Saídas</span>
              </div>
            </div>
            {flowSeries.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title="Sem lançamentos no período" />
            ) : (
              <>
                <div className="flex items-end gap-4 h-[150px] mt-5.5">
                  {flowSeries.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex items-end justify-center gap-1.5 h-[130px]">
                        <div className="w-[44%] rounded-t-[6px] rounded-b-[3px] animate-grow-y" style={{ background: "var(--accent)", height: `${(m.income / flowMax) * 100}%` }} />
                        <div className="w-[44%] rounded-t-[6px] rounded-b-[3px] animate-grow-y" style={{ background: "var(--surface-3)", height: `${(m.expense / flowMax) * 100}%`, animationDelay: ".1s" }} />
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {new Date(m.month + "-01").toLocaleDateString("pt-BR", { month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-[var(--border)] pt-3.5 flex gap-6 flex-wrap">
                  <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)]">Sobra do mês</div>
                    <div className="text-base font-semibold mt-0.5" style={{ color: financeNet >= 0 ? "var(--accent)" : "var(--danger)" }}>
                      {mask(formatBRLCompact(financeNet))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)]">Taxa de poupança</div>
                    <div className="text-base font-semibold mt-0.5 text-[var(--text-primary)]">
                      {lastSavings?.savings_rate != null ? formatPercent(savingsFraction * 100) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)]">Burn rate</div>
                    <div className="text-base font-semibold mt-0.5 text-[var(--text-primary)]">{mask(formatBRLCompact(burnRate))}</div>
                  </div>
                </div>
              </>
            )}
          </DashboardCard>
        )}

        {/* Fatura atual */}
        {visible("bill") && (
          <DashboardCard {...widgetProps("bill", 0.18)}>
            <div className="text-sm font-semibold text-[var(--text-primary)]">Fatura atual</div>
            {billCards.length === 0 ? (
              <EmptyState icon={Landmark} title="Nenhum cartão cadastrado" description="Cadastre um cartão na tela de Cartões." />
            ) : (
              <>
                <div className="mt-4.5 mb-1.5 text-[30px] font-semibold tracking-[-.04em] tabular-nums text-[var(--text-primary)]">
                  {mask(formatBRLExact(billTotal))}
                </div>
                {billLimitTotal > 0 && (
                  <>
                    <div className="h-2 rounded-md bg-[var(--surface-3)] overflow-hidden mt-3.5">
                      <div className="h-full rounded-md animate-grow-y" style={{ width: `${Math.min(100, (billTotal / billLimitTotal) * 100)}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-2))" }} />
                    </div>
                    <div className="flex justify-between text-[11.5px] text-[var(--text-secondary)] mt-2">
                      <span>{Math.round((billTotal / billLimitTotal) * 100)}% do limite</span>
                      <span>{formatBRLCompact(billLimitTotal)}</span>
                    </div>
                  </>
                )}
                <div className="mt-4.5 flex flex-col gap-3">
                  {billCards.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2.5">
                      <div className="w-[34px] h-[22px] rounded-[5px] border border-[var(--border-strong)]" style={{ background: `linear-gradient(135deg, ${CATEGORICAL[i % CATEGORICAL.length]}, var(--surface-3))` }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium truncate text-[var(--text-primary)]">{c.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">•••• {c.last4 ?? "----"}</div>
                      </div>
                      <b className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                        {latestInvoices[i]?.total_amount != null ? mask(formatBRLExact(Number(latestInvoices[i]!.total_amount))) : "—"}
                      </b>
                    </div>
                  ))}
                </div>
                {!hasAnyInvoice && (
                  <p className="text-[11px] text-[var(--text-muted)] mt-3">Nenhuma fatura enviada ainda.</p>
                )}
              </>
            )}
          </DashboardCard>
        )}

        {/* Metas */}
        {visible("goals") && (
          <DashboardCard {...widgetProps("goals", 0.24)}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Metas</div>
              <Link href="/goals" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Ver todas</Link>
            </div>
            {goals.length === 0 ? (
              <EmptyState icon={TargetIcon} title="Nenhuma meta ainda" description="Crie uma meta na tela de Metas." />
            ) : (
              <div className="flex flex-col gap-4">
                {goals.slice(0, 3).map((g) => (
                  <div key={g.id}>
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <span className="flex-1 font-medium text-[var(--text-primary)] truncate">{g.name}</span>
                      <span className="text-[var(--text-secondary)] tabular-nums">
                        {mask(formatBRLCompact(Number(g.current_amount)))} / {mask(formatBRLCompact(Number(g.target_amount)))}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-md bg-[var(--surface-3)] mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-[width] duration-700"
                        style={{ width: `${Math.min(100, Number(g.pct_complete) * 100)}%`, background: g.color ?? "var(--accent)" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        )}

        {/* Movimentações recentes */}
        {visible("tx") && (
          <DashboardCard {...widgetProps("tx", 0.3)}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Movimentações recentes</div>
              <Link href="/transactions" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Extrato completo</Link>
            </div>
            {!txPage || txPage.items.length === 0 ? (
              <EmptyState icon={ArrowLeftRight} title="Nenhuma transação ainda" />
            ) : (
              <div>
                {txPage.items.map((t) => {
                  const amount = Number(t.amount);
                  const positive = t.transaction_type === "income";
                  const ini = (t.description ?? t.category_name ?? "?").slice(0, 2).toUpperCase();
                  return (
                    <Link
                      key={t.id}
                      href="/transactions"
                      className="w-full flex items-center gap-3.5 py-3 px-2.5 rounded-2xl text-left transition-colors border-b border-[var(--border)] hover:bg-[var(--surface-2)]"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[var(--surface-3)] flex items-center justify-center text-[13px] font-semibold text-[var(--text-secondary)] flex-shrink-0">{ini}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate text-[var(--text-primary)]">{t.description ?? t.category_name ?? "Transação"}</div>
                        <div className="text-[11.5px] text-[var(--text-muted)] mt-0.5">{relativeDate(t.transaction_date)}</div>
                      </div>
                      {t.category_name && (
                        <div className="text-[11.5px] text-[var(--text-secondary)] px-2.5 py-1 rounded-lg bg-[var(--surface-2)] hidden sm:block">{t.category_name}</div>
                      )}
                      <div className="w-[118px] text-right text-[13.5px] font-semibold tabular-nums" style={{ color: positive ? "var(--accent)" : "var(--danger)" }}>
                        {mask(`${positive ? "+" : "-"} ${formatBRLExact(Math.abs(amount))}`)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </DashboardCard>
        )}

        {/* Saúde financeira */}
        {visible("health") && (
          <DashboardCard {...widgetProps("health", 0.36)}>
            <div className="text-sm font-semibold mb-4 text-[var(--text-primary)]">Saúde financeira</div>
            <div className="flex items-center gap-4.5">
              <DonutRing size={96} strokeWidth={9} segments={[{ fraction: Math.max(0, Math.min(1, savingsFraction)), color: "var(--accent)" }]} />
              <div>
                <div className="text-[32px] font-semibold tracking-[-.04em] text-[var(--text-primary)]">
                  {lastSavings?.savings_rate != null ? `${Math.round(savingsFraction * 100)}%` : "—"}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">Taxa de poupança do mês</div>
              </div>
            </div>
            <div className="mt-4.5 flex flex-col gap-2.5 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Reserva de emergência</span>
                <b className="font-semibold text-[var(--text-primary)]">
                  {runwayMonths != null ? `${formatDecimal(runwayMonths, 1)} meses` : "—"}
                </b>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Burn rate mensal</span>
                <b className="font-semibold text-[var(--text-primary)]">{mask(formatBRLCompact(burnRate))}</b>
              </div>
            </div>
          </DashboardCard>
        )}
      </div>
    </div>
  );
}
