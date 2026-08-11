"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueries } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, X, Landmark, Target as TargetIcon, ArrowLeftRight } from "lucide-react";
import { listPortfolios, type Portfolio, type PerformancePeriod } from "@/lib/portfolio-api";
import { listInvoices, type CardInvoice } from "@/lib/cards-api";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { usePortfolioPerformance } from "@/hooks/usePortfolioPerformance";
import { useAccounts } from "@/hooks/useAccounts";
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
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";

const PERIOD_MAP: Record<Period, PerformancePeriod> = { "1M": "1m", "6M": "6m", "1A": "1y", Tudo: "max" };

const WIDGET_LABELS: Record<string, string> = {
  net: "Patrimônio", alloc: "Alocação", flow: "Fluxo de caixa",
  bill: "Fatura", goals: "Metas", tx: "Movimentações", health: "Saúde financeira",
};
const WIDGET_SPAN: Record<string, number> = { net: 8, alloc: 4, flow: 5, bill: 3, goals: 4, tx: 8, health: 4 };
const DEFAULT_ORDER = ["net", "alloc", "flow", "bill", "goals", "tx", "health"];
const STORAGE_KEY = "investiq-overview-layout";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

interface WidgetProps {
  id: string;
  customize: boolean;
  dragged: string | null;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
  onHide: (id: string) => void;
  order: number;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

function Widget({ id, customize, dragged, onDragStart, onDrop, onHide, order, delay = 0, className = "", children }: WidgetProps) {
  return (
    <section
      draggable={customize}
      onDragStart={() => onDragStart(id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (dragged && dragged !== id) onDrop(id); }}
      style={{ order, gridColumn: `span ${WIDGET_SPAN[id]}`, animationDelay: `${delay}s` }}
      className={`animate-rise-up relative border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] overflow-hidden ${className}`}
    >
      {children}
      {customize && (
        <button
          onClick={() => onHide(id)}
          className="absolute top-3.5 right-3.5 w-[26px] h-[26px] rounded-lg bg-[var(--surface-3)] border border-[var(--border-strong)] text-[var(--text-secondary)] text-sm flex items-center justify-center z-10"
          aria-label={`Ocultar ${WIDGET_LABELS[id]}`}
        >
          <X size={14} />
        </button>
      )}
    </section>
  );
}

export function OverviewClient() {
  const { period, privacy, customize } = useUIStore(
    useShallow((s) => ({ period: s.period, privacy: s.privacy, customize: s.customize }))
  );
  const perfPeriod = PERIOD_MAP[period];

  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<string[]>([]);
  const [dragged, setDragged] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setOrder(parsed.order);
        if (Array.isArray(parsed.hidden)) setHidden(parsed.hidden);
      }
    } catch { /* localStorage indisponível — segue com o layout padrão */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, hidden })); } catch { /* ignora */ }
  }, [order, hidden]);

  const handleDrop = (targetId: string) => {
    if (!dragged) return;
    const next = order.slice();
    next.splice(next.indexOf(dragged), 1);
    next.splice(next.indexOf(targetId), 0, dragged);
    setOrder(next);
    setDragged(null);
  };
  const handleHide = (id: string) => setHidden((h) => h.concat(id));
  const handleRestore = (id: string) => setHidden((h) => h.filter((x) => x !== id));

  // ── Dados ────────────────────────────────────────────────────────────────
  const { data: portfolios = [] } = useQuery<Portfolio[]>({ queryKey: ["portfolios"], queryFn: listPortfolios, staleTime: 30_000 });
  const portfolioId = portfolios.find((p) => p.is_default)?.id ?? portfolios[0]?.id ?? null;

  const { data: summary } = usePortfolioSummary(portfolioId);
  const { data: performance = [] } = usePortfolioPerformance(portfolioId, perfPeriod);
  const { data: accounts = [] } = useAccounts();
  const { data: cards = [] } = useCards();
  const { data: goals = [] } = useGoals();
  const { data: txPage } = useTransactions({ per_page: 6, page: 1 });
  const { data: finSummary } = useFinanceSummary(currentMonth());
  const { data: analytics } = useAnalytics(6);

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

  const liquid = accounts.filter((a) => a.include_in_total).reduce((sum, a) => sum + Number(a.balance), 0);
  const invested = Number(summary?.total_market_value_brl ?? 0);
  const netWorth = liquid + invested - billTotal;

  const perfValues = performance.map((p) => Number(p.total_value));
  const netDeltaFraction = perfValues.length >= 2 && perfValues[0] !== 0
    ? (perfValues[perfValues.length - 1] - perfValues[0]) / Math.abs(perfValues[0])
    : null;
  const axisLabels = performance.length > 0
    ? performance.filter((_, i) => i % Math.max(1, Math.floor(performance.length / 5)) === 0 || i === performance.length - 1)
        .slice(-6)
        .map((p) => new Date(p.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }))
    : [];

  const allocation = (summary?.allocation_by_type ?? []).map((a) => ({ ...a, weight: Number(a.weight) }));

  const flowSeries = (finSummary?.monthly_series ?? []).map((m) => ({ ...m, income: Number(m.income), expense: Number(m.expense) })).slice(-6);
  const flowMax = Math.max(1, ...flowSeries.flatMap((m) => [m.income, m.expense]));

  const savingsSeries = analytics?.savings_series ?? [];
  const lastSavingsRaw = savingsSeries[savingsSeries.length - 1];
  const lastSavings = lastSavingsRaw ? { ...lastSavingsRaw, savings_rate: lastSavingsRaw.savings_rate != null ? Number(lastSavingsRaw.savings_rate) : null } : undefined;
  const savingsFraction = lastSavings?.savings_rate ?? 0;
  const runwayMonths = analytics?.runway_months != null ? Number(analytics.runway_months) : null;
  const burnRate = Number(analytics?.burn_rate ?? 0);
  const totalPnlPercent = Number(summary?.total_pnl_percent ?? 0);
  const financeNet = Number(finSummary?.net ?? 0);

  const mask = (text: string) => maskValue(text, privacy);
  const visible = (id: string) => !hidden.includes(id);
  const hiddenList = hidden.filter((id) => WIDGET_LABELS[id]);

  const widgetProps = (id: string, delay: number) => ({
    id, customize, dragged, onDragStart: setDragged, onDrop: handleDrop, onHide: handleHide,
    order: order.indexOf(id), delay,
  });

  return (
    <div>
      <OnboardingChecklist />
      {customize && (
        <div className="flex items-center gap-3 flex-wrap px-4 py-3 border border-dashed border-[var(--accent)] rounded-2xl bg-[var(--glow)] mb-5 animate-rise-up">
          <span className="text-[12.5px] font-medium text-[var(--text-primary)]">
            Modo edição — arraste os cartões para reordenar, use × para ocultar.
          </span>
          {hiddenList.map((id) => (
            <button
              key={id}
              onClick={() => handleRestore(id)}
              className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-secondary)]"
            >
              + {WIDGET_LABELS[id]}
            </button>
          ))}
        </div>
      )}

      <div className="responsive-grid-12 grid gap-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>

        {/* Patrimônio líquido */}
        {visible("net") && (
          <Widget {...widgetProps("net", 0)}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(700px 220px at 12% -10%, var(--glow), transparent 70%)" }} />
            <div className="relative flex items-start gap-5 flex-wrap">
              <div className="flex-1">
                <div className="text-xs text-[var(--text-secondary)] tracking-[.08em] uppercase">Patrimônio líquido</div>
                <div className="flex items-baseline gap-3.5 mt-2">
                  <div className="text-[44px] font-semibold tracking-[-.045em] tabular-nums whitespace-nowrap text-[var(--text-primary)]">
                    {mask(formatBRLExact(netWorth))}
                  </div>
                  <DeltaPill fraction={netDeltaFraction} />
                </div>
                <div className="text-[12.5px] text-[var(--text-secondary)] mt-1.5">Contas, investimentos e faturas em aberto</div>
              </div>
              <div className="flex gap-6 pt-1.5 flex-wrap">
                <div>
                  <div className="text-[11.5px] text-[var(--text-secondary)]">Líquido</div>
                  <div className="text-[17px] font-semibold mt-0.5 tabular-nums text-[var(--text-primary)]">{mask(formatBRLCompact(liquid))}</div>
                </div>
                <div>
                  <div className="text-[11.5px] text-[var(--text-secondary)]">Investido</div>
                  <div className="text-[17px] font-semibold mt-0.5 tabular-nums text-[var(--text-primary)]">{mask(formatBRLCompact(invested))}</div>
                </div>
                <div>
                  <div className="text-[11.5px] text-[var(--text-secondary)]">Passivos</div>
                  <div className="text-[17px] font-semibold mt-0.5 tabular-nums" style={{ color: billTotal > 0 ? "var(--danger)" : "var(--text-primary)" }}>
                    {mask(formatBRLCompact(billTotal))}
                  </div>
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
          </Widget>
        )}

        {/* Alocação */}
        {visible("alloc") && (
          <Widget {...widgetProps("alloc", 0.06)}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Alocação</div>
            </div>
            {allocation.length === 0 ? (
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
                        <b className="font-semibold text-[var(--text-primary)]">{(a.weight * 100).toFixed(0)}%</b>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4.5 border-t border-[var(--border)] pt-3.5 flex justify-between text-[12.5px]">
                  <span className="text-[var(--text-secondary)]">Rentabilidade da carteira</span>
                  <b className="font-semibold" style={{ color: totalPnlPercent >= 0 ? "var(--accent)" : "var(--danger)" }}>
                    {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(1)}%
                  </b>
                </div>
              </>
            )}
          </Widget>
        )}

        {/* Fluxo de caixa */}
        {visible("flow") && (
          <Widget {...widgetProps("flow", 0.12)}>
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
                      {lastSavings?.savings_rate != null ? `${(savingsFraction * 100).toFixed(1)}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)]">Burn rate</div>
                    <div className="text-base font-semibold mt-0.5 text-[var(--text-primary)]">{mask(formatBRLCompact(burnRate))}</div>
                  </div>
                </div>
              </>
            )}
          </Widget>
        )}

        {/* Fatura atual */}
        {visible("bill") && (
          <Widget {...widgetProps("bill", 0.18)}>
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
          </Widget>
        )}

        {/* Metas */}
        {visible("goals") && (
          <Widget {...widgetProps("goals", 0.24)}>
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
          </Widget>
        )}

        {/* Movimentações recentes */}
        {visible("tx") && (
          <Widget {...widgetProps("tx", 0.3)}>
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
          </Widget>
        )}

        {/* Saúde financeira */}
        {visible("health") && (
          <Widget {...widgetProps("health", 0.36)}>
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
                  {runwayMonths != null ? `${runwayMonths.toFixed(1)} meses` : "—"}
                </b>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Burn rate mensal</span>
                <b className="font-semibold text-[var(--text-primary)]">{mask(formatBRLCompact(burnRate))}</b>
              </div>
            </div>
          </Widget>
        )}
      </div>
    </div>
  );
}
