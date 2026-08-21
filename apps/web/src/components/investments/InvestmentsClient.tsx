"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Download, FileText } from "lucide-react";
import { listPortfolios, type Portfolio, type PerformancePeriod, type PositionSummary } from "@/lib/portfolio-api";
import { apiClient } from "@/lib/api-client";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { usePortfolioPerformance } from "@/hooks/usePortfolioPerformance";
import { usePortfolioBenchmark } from "@/hooks/usePortfolioBenchmark";
import { usePortfolioLookThrough } from "@/hooks/usePortfolioLookThrough";
import { PortfolioTabs } from "./PortfolioTabs";
import { PositionsTable } from "./PositionsTable";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { PERIODS, formatBRLExact, formatBRLCompact, formatCurrencyExact, formatPct } from "@/components/charts/chartTheme";
import { Globe2 } from "lucide-react";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { useMask } from "@/hooks/useMask";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NewPortfolioModal } from "./modals/NewPortfolioModal";
import { AddPositionModal } from "./modals/AddPositionModal";
import { NewTransactionModal } from "./modals/NewTransactionModal";
import { ManagePositionModal } from "./modals/ManagePositionModal";
import { formatPercent } from "@/lib/number-format";
import { ExportReportModal } from "@/components/reports/ExportReportModal";

const AllocationDonut = dynamic(
  () => import("@/components/charts/AllocationDonut").then((m) => m.AllocationDonut),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const PortfolioEvolutionChart = dynamic(
  () => import("@/components/charts/PortfolioEvolutionChart").then((m) => m.PortfolioEvolutionChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const BenchmarkChart = dynamic(
  () => import("@/components/charts/BenchmarkChart").then((m) => m.BenchmarkChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const LookThroughDonut = dynamic(
  () => import("@/components/charts/LookThroughDonut").then((m) => m.LookThroughDonut),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
// A aba inteira (não só o gráfico) — só monta quando o usuário clica em
// "Proventos", então nem o seu recharts nem o resto do módulo precisam
// entrar no carregamento inicial de "Posições", a aba padrão.
const IncomeTab = dynamic(() => import("./IncomeTab").then((m) => m.IncomeTab), {
  ssr: false,
  // Não usa ChartSkeleton aqui: essa aba inteira (não só um gráfico dentro
  // de um ChartCard já position:relative) é o que está sendo carregado, e
  // o container em volta não tem position:relative garantido.
  loading: () => <div className="h-96 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />,
});

interface Props {
  initialPortfolios: Portfolio[];
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function InvestmentsClient({ initialPortfolios }: Props) {
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(
    initialPortfolios[0]?.id ?? null
  );
  const [showNewPortfolio, setShowNewPortfolio] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [defaultTransactionPositionId, setDefaultTransactionPositionId] = useState<
    string | undefined
  >(undefined);
  const [managingPosition, setManagingPosition] = useState<PositionSummary | null>(null);
  const [performancePeriod, setPerformancePeriod] = useState<PerformancePeriod>("1y");
  const [allocationMode, setAllocationMode] = useState<"type" | "asset">("type");
  const [lookThroughMode, setLookThroughMode] = useState<"sector" | "country" | "class">("sector");
  const [activeTab, setActiveTab] = useState<"positions" | "income">("positions");
  const mask = useMask();

  const { data: portfolios = initialPortfolios } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: listPortfolios,
    initialData: initialPortfolios.length > 0 ? initialPortfolios : undefined,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  });

  const { data: summary, isLoading: isSummaryLoading, isError: isSummaryError, refetch: refetchSummary, dataUpdatedAt } =
    usePortfolioSummary(activePortfolioId);
  const { data: performance, isLoading: isPerformanceLoading, isError: isPerformanceError, refetch: refetchPerformance } =
    usePortfolioPerformance(activePortfolioId, performancePeriod);
  const { data: benchmark, isLoading: isBenchmarkLoading, isError: isBenchmarkError, refetch: refetchBenchmark } =
    usePortfolioBenchmark(activePortfolioId, performancePeriod);
  const { data: lookThrough, isLoading: isLookThroughLoading, isError: isLookThroughError, refetch: refetchLookThrough } =
    usePortfolioLookThrough(activePortfolioId);

  // Handle case when activePortfolioId is null but portfolios exist
  useEffect(() => {
    if (activePortfolioId === null && portfolios.length > 0) {
      setActivePortfolioId(portfolios[0].id);
    }
  }, [portfolios, activePortfolioId]);

  const handleExport = async () => {
    if (!activePortfolioId) return;
    const res = await apiClient.get(`/portfolios/${activePortfolioId}/export`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${summary?.portfolio_name ?? "portfolio"}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Decimal do backend chega como string no JSON — sem Number(), .toFixed e
  // comparações numéricas quebram.
  const marketValue = Number(summary?.total_market_value_brl ?? 0);
  const investedValue = Number(summary?.total_invested_brl ?? 0);
  const pnlAbsolute = Number(summary?.total_pnl_absolute ?? 0);
  const pnlPercent = Number(summary?.total_pnl_percent ?? 0);

  // Ativos cuja moeda nativa não é BRL — agrupados por moeda, com o valor
  // nativo (o que aparece na corretora americana) ao lado do equivalente
  // em reais já usado no resto da tela.
  const internationalByCurrency = (summary?.positions ?? []).reduce<
    Record<string, { native: number; brl: number }>
  >((acc, p) => {
    if (p.currency === "BRL") return acc;
    const group = acc[p.currency] ?? { native: 0, brl: 0 };
    group.native += p.market_value_native;
    group.brl += p.market_value_brl;
    acc[p.currency] = group;
    return acc;
  }, {});
  const internationalCurrencies = Object.keys(internationalByCurrency);

  return (
    <div className="flex flex-col h-full">
      {/* Ações */}
      <div className="flex items-center justify-between px-[30px] pt-[22px]">
        {portfolios.length > 0 ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] text-[var(--text-muted)] tracking-[.1em] uppercase flex-shrink-0">
              Carteiras
            </span>
            <PortfolioTabs
              portfolios={portfolios}
              activeId={activePortfolioId}
              onChange={setActivePortfolioId}
            />
          </div>
        ) : <div />}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowNewPortfolio(true)}>
            + Nova carteira
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAddPosition(true)}
            disabled={!activePortfolioId}
          >
            + Ativo
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { setDefaultTransactionPositionId(undefined); setShowNewTransaction(true); }}
            disabled={!activePortfolioId}
          >
            + Transação
          </Button>
        </div>
      </div>

      <div className="px-[30px] pt-3">
        <OnboardingChecklist />
      </div>

      {/* Empty state */}
      {portfolios.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={LayoutDashboard}
            title="Nenhuma carteira encontrada."
            description="Crie sua primeira carteira para começar a acompanhar seus investimentos."
            action={<Button onClick={() => setShowNewPortfolio(true)}>Criar carteira</Button>}
          />
        </div>
      )}

      {/* Summary failed to load — the whole dashboard below depends on it,
          so show one error instead of every panel quietly rendering empty. */}
      {portfolios.length > 0 && isSummaryError && !isSummaryLoading && (
        <div className="flex-1 flex items-center justify-center">
          <ErrorState
            title="Não foi possível carregar a carteira."
            onRetry={refetchSummary}
          />
        </div>
      )}

      {/* Main layout */}
      {portfolios.length > 0 && !isSummaryError && (
        <div className="flex-1 overflow-auto p-[26px_30px_60px]">
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-[var(--text-muted)] text-right mb-2">
              Atualizado às {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}

          <div className="responsive-grid-12 grid gap-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
            {/* Carteira total */}
            <section className="col-span-8 relative border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] overflow-hidden animate-rise-up">
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(600px 200px at 80% -20%, var(--glow), transparent 70%)" }} />
              <div className="relative flex justify-between items-start flex-wrap gap-4">
                <div>
                  <div className="text-xs text-[var(--text-secondary)] tracking-[.08em] uppercase">Carteira total</div>
                  {isSummaryLoading ? (
                    <Skeleton className="h-9 w-48 mt-1.5" />
                  ) : (
                    <div className="text-4xl font-semibold tracking-[-.045em] mt-1.5 tabular-nums text-[var(--text-primary)]">
                      {mask(formatBRLExact(marketValue))}
                    </div>
                  )}
                  {isSummaryLoading ? (
                    <Skeleton className="h-4 w-40 mt-2.5" />
                  ) : (
                    <div className="flex items-center gap-2.5 mt-2 text-[13px]">
                      <span className="font-semibold" style={{ color: pnlAbsolute >= 0 ? "var(--accent)" : "var(--danger)" }}>
                        {mask(`${pnlAbsolute >= 0 ? "+" : ""}${formatBRLCompact(pnlAbsolute)}`)}
                      </span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <span className="text-[var(--text-secondary)]">
                        {formatPercent(pnlPercent, 1, { signed: true })} desde o início
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-6">
                  <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)]">Total investido</div>
                    {isSummaryLoading ? (
                      <Skeleton className="h-[17px] w-16 mt-1" />
                    ) : (
                      <div className="text-[17px] font-semibold mt-0.5 text-[var(--text-primary)]">{mask(formatBRLCompact(investedValue))}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-[11.5px] text-[var(--text-secondary)]">Resultado</div>
                    {isSummaryLoading ? (
                      <Skeleton className="h-[17px] w-16 mt-1" />
                    ) : (
                      <div className="text-[17px] font-semibold mt-0.5" style={{ color: pnlAbsolute >= 0 ? "var(--accent)" : "var(--danger)" }}>
                        {mask(formatBRLCompact(pnlAbsolute))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden p-[3px] gap-1">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPerformancePeriod(p.value)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: performancePeriod === p.value ? "var(--surface-3)" : "transparent",
                        color: performancePeriod === p.value ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <ChartCard
                  title="" bare
                  isLoading={isPerformanceLoading}
                  isError={isPerformanceError}
                  onRetry={refetchPerformance}
                  isEmpty={!performance || performance.length === 0}
                  emptyMessage="Registre transações para ver a evolução da carteira."
                >
                  <PortfolioEvolutionChart data={performance ?? []} />
                </ChartCard>
              </div>
            </section>

            {/* Alocação */}
            <section className="col-span-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".08s" }}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Alocação</div>
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                  {([["type", "Tipo"], ["asset", "Ativo"]] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setAllocationMode(mode)}
                      className="px-2 py-1 text-[11px] transition-colors"
                      style={{
                        background: allocationMode === mode ? "var(--surface-3)" : "transparent",
                        color: allocationMode === mode ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <ChartCard
                  title="" bare
                  isLoading={isSummaryLoading}
                  isError={isSummaryError}
                  onRetry={refetchSummary}
                  isEmpty={!summary || summary.allocation_by_type.length === 0}
                  emptyMessage="Adicione posições para ver a alocação."
                >
                  <AllocationDonut
                    allocation={
                      allocationMode === "type"
                        ? summary?.allocation_by_type ?? []
                        : (summary?.positions ?? []).map((p) => ({
                            asset_type: p.ticker,
                            value: p.market_value_brl,
                            weight: p.weight,
                          }))
                    }
                  />
                </ChartCard>
              </div>
            </section>

            {/* Patrimônio internacional: ativos em moeda estrangeira, valor nativo + equivalente em BRL */}
            {internationalCurrencies.length > 0 && (
              <section className="col-span-12 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".1s" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Globe2 size={15} className="text-[var(--text-secondary)]" />
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Patrimônio internacional</div>
                </div>
                <div className="flex flex-wrap gap-6">
                  {internationalCurrencies.map((currency) => {
                    const group = internationalByCurrency[currency];
                    const weight = marketValue > 0 ? group.brl / marketValue : 0;
                    return (
                      <div key={currency}>
                        <div className="text-[11.5px] text-[var(--text-secondary)]">
                          Ativos em {currency} · {formatPct(weight)} da carteira
                        </div>
                        <div className="flex items-baseline gap-2.5 mt-0.5">
                          <span className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                            {mask(formatCurrencyExact(group.native, currency))}
                          </span>
                          <span className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                            ≈ {mask(formatBRLExact(group.brl))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Raio-X da carteira: look-through geográfico e setorial */}
            <section className="col-span-12 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".11s" }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Raio-X da carteira</div>
                  <div className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
                    Olhando através de cada ETF/fundo para suas posições de verdade
                  </div>
                </div>
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                  {([["sector", "Setor"], ["country", "Região"], ["class", "Classe"]] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setLookThroughMode(mode)}
                      className="px-2.5 py-1 text-[11px] transition-colors"
                      style={{
                        background: lookThroughMode === mode ? "var(--surface-3)" : "transparent",
                        color: lookThroughMode === mode ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <ChartCard
                  title="" bare
                  isLoading={isLookThroughLoading}
                  isError={isLookThroughError}
                  onRetry={refetchLookThrough}
                  isEmpty={
                    !lookThrough ||
                    (lookThroughMode === "sector" ? lookThrough.by_sector.length === 0
                      : lookThroughMode === "country" ? lookThrough.by_country.length === 0
                      : lookThrough.by_asset_class.length === 0)
                  }
                  emptyMessage="Adicione posições para ver a distribuição."
                >
                  <LookThroughDonut
                    buckets={
                      lookThroughMode === "sector" ? lookThrough?.by_sector ?? []
                        : lookThroughMode === "country" ? lookThrough?.by_country ?? []
                        : lookThrough?.by_asset_class ?? []
                    }
                    ariaLabel={
                      lookThroughMode === "sector" ? "Distribuição por setor"
                        : lookThroughMode === "country" ? "Distribuição geográfica"
                        : "Distribuição por classe de ativo"
                    }
                  />
                </ChartCard>
              </div>
              {lookThroughMode === "country" && lookThrough && lookThrough.country_coverage < 0.95 && (
                <p className="text-[11px] text-[var(--text-muted)] mt-3">
                  A geografia dos fundos é estimada a partir das maiores posições de cada ETF — cobre{" "}
                  {(lookThrough.country_coverage * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da carteira com dado confiável; o restante aparece como &quot;Não mapeado&quot;.
                </p>
              )}
            </section>

            {/* Benchmark */}
            <section className="col-span-12 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".14s" }}>
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">Rentabilidade da carteira</div>
              <ChartCard
                title="" bare
                isLoading={isBenchmarkLoading}
                isError={isBenchmarkError}
                onRetry={refetchBenchmark}
                isEmpty={!benchmark || benchmark.length === 0}
                emptyMessage="Registre transações para comparar a carteira com CDI, Ibovespa, Nasdaq e S&P 500."
                height={300}
              >
                <BenchmarkChart data={benchmark ?? []} />
              </ChartCard>
            </section>

            {/* Posições */}
            <section className="col-span-12 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".2s" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden p-[3px] gap-1">
                  {([["positions", "Posições"], ["income", "Proventos"]] as const).map(([tab, label]) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: activeTab === tab ? "var(--surface-3)" : "transparent",
                        color: activeTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Download size={13} /> Exportar CSV
                  </button>
                  <button
                    onClick={() => setShowExport(true)}
                    className="flex items-center gap-1.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <FileText size={13} /> Exportar relatório
                  </button>
                </div>
              </div>

              {activeTab === "positions" ? (
                <PositionsTable
                  positions={summary?.positions ?? []}
                  isLoading={isSummaryLoading}
                  onAddTransaction={(positionId, _ticker) => {
                    setDefaultTransactionPositionId(positionId);
                    setShowNewTransaction(true);
                  }}
                  onManage={setManagingPosition}
                />
              ) : (
                activePortfolioId && <IncomeTab portfolioId={activePortfolioId} />
              )}
            </section>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewPortfolio && (
        <NewPortfolioModal onClose={() => setShowNewPortfolio(false)} />
      )}
      {showAddPosition && activePortfolioId && (
        <AddPositionModal
          onClose={() => setShowAddPosition(false)}
          portfolioId={activePortfolioId}
        />
      )}
      {showNewTransaction && activePortfolioId && (
        <NewTransactionModal
          onClose={() => {
            setShowNewTransaction(false);
            setDefaultTransactionPositionId(undefined);
          }}
          portfolioId={activePortfolioId}
          positions={summary?.positions ?? []}
          defaultPositionId={defaultTransactionPositionId}
        />
      )}
      {managingPosition && activePortfolioId && (
        <ManagePositionModal
          portfolioId={activePortfolioId}
          position={managingPosition}
          onClose={() => setManagingPosition(null)}
        />
      )}
      {showExport && (
        <ExportReportModal
          month={currentMonth()}
          origin="investments"
          // A carteira aberta na tela já vem marcada — exportar daqui quase
          // sempre significa "esta carteira", não todas.
          defaultPortfolioIds={activePortfolioId ? [activePortfolioId] : []}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
