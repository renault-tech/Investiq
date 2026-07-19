"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Download } from "lucide-react";
import { listPortfolios, type Portfolio, type PerformancePeriod } from "@/lib/portfolio-api";
import { apiClient } from "@/lib/api-client";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { usePortfolioPerformance } from "@/hooks/usePortfolioPerformance";
import { PortfolioTabs } from "./PortfolioTabs";
import { LeftPanel } from "./LeftPanel";
import { PositionsTable } from "./PositionsTable";
import { IncomeTab } from "./IncomeTab";
import { ChartCard } from "@/components/charts/ChartCard";
import { AllocationDonut } from "@/components/charts/AllocationDonut";
import { PortfolioEvolutionChart, PERIODS } from "@/components/charts/PortfolioEvolutionChart";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewPortfolioModal } from "./modals/NewPortfolioModal";
import { AddPositionModal } from "./modals/AddPositionModal";
import { NewTransactionModal } from "./modals/NewTransactionModal";

interface Props {
  initialPortfolios: Portfolio[];
}

export function InvestmentsClient({ initialPortfolios }: Props) {
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(
    initialPortfolios[0]?.id ?? null
  );
  const [showNewPortfolio, setShowNewPortfolio] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [defaultTransactionPositionId, setDefaultTransactionPositionId] = useState<
    string | undefined
  >(undefined);
  const [performancePeriod, setPerformancePeriod] = useState<PerformancePeriod>("1y");
  const [allocationMode, setAllocationMode] = useState<"type" | "asset">("type");
  const [activeTab, setActiveTab] = useState<"positions" | "income">("positions");

  const { data: portfolios = initialPortfolios } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: listPortfolios,
    initialData: initialPortfolios.length > 0 ? initialPortfolios : undefined,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  });

  const { data: summary, isLoading: isSummaryLoading, dataUpdatedAt } =
    usePortfolioSummary(activePortfolioId);
  const { data: performance, isLoading: isPerformanceLoading } =
    usePortfolioPerformance(activePortfolioId, performancePeriod);

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Investimentos</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowNewPortfolio(true)}>
            + Portfólio
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

      {/* Portfolio Tabs */}
      {portfolios.length > 0 && (
        <div className="px-6 py-2 border-b border-[var(--border)]">
          <PortfolioTabs
            portfolios={portfolios}
            activeId={activePortfolioId}
            onChange={setActivePortfolioId}
          />
        </div>
      )}

      {/* Empty state */}
      {portfolios.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={LayoutDashboard}
            title="Nenhum portfólio encontrado."
            description="Crie seu primeiro portfólio para começar a acompanhar seus investimentos."
            action={<Button onClick={() => setShowNewPortfolio(true)}>Criar Portfólio</Button>}
          />
        </div>
      )}

      {/* Main split layout */}
      {portfolios.length > 0 && (
        <div className="flex flex-1 min-h-0">
          <div className="w-[210px] shrink-0 border-r border-[var(--border)] overflow-y-auto p-4">
            <LeftPanel summary={summary} isLoading={isSummaryLoading} />
          </div>
          <div className="flex-1 overflow-auto p-4">
            {dataUpdatedAt > 0 && (
              <p className="text-xs text-[var(--text-muted)] text-right mb-2">
                Atualizado às {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            )}

            {/* Visão Geral — gráficos */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
              <div className="xl:col-span-2">
                <ChartCard
                  title="Evolução patrimonial"
                  isLoading={isPerformanceLoading}
                  isEmpty={!performance || performance.length === 0}
                  emptyMessage="Registre transações para ver a evolução da carteira."
                  actions={
                    <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                      {PERIODS.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setPerformancePeriod(p.value)}
                          className={`px-2 py-0.5 text-xs transition-colors ${
                            performancePeriod === p.value
                              ? "bg-[var(--navy)] text-white"
                              : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <PortfolioEvolutionChart data={performance ?? []} />
                </ChartCard>
              </div>
              <ChartCard
                title="Alocação"
                isLoading={isSummaryLoading}
                isEmpty={!summary || summary.allocation_by_type.length === 0}
                emptyMessage="Adicione posições para ver a alocação."
                actions={
                  <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                    {([["type", "Tipo"], ["asset", "Ativo"]] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => setAllocationMode(mode)}
                        className={`px-2 py-0.5 text-xs transition-colors ${
                          allocationMode === mode
                            ? "bg-[var(--navy)] text-white"
                            : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                }
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

            <div className="flex items-center justify-between mb-2">
              <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                {([["positions", "Posições"], ["income", "Proventos"]] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs transition-colors ${
                      activeTab === tab
                        ? "bg-[var(--navy)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Download size={13} /> Exportar CSV
              </button>
            </div>

            {activeTab === "positions" ? (
              <PositionsTable
                positions={summary?.positions ?? []}
                isLoading={isSummaryLoading}
                onAddTransaction={(positionId, _ticker) => {
                  setDefaultTransactionPositionId(positionId);
                  setShowNewTransaction(true);
                }}
              />
            ) : (
              activePortfolioId && <IncomeTab portfolioId={activePortfolioId} />
            )}
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
    </div>
  );
}
