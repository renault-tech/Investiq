"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { listPortfolios, type Portfolio } from "@/lib/portfolio-api";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { PortfolioTabs } from "./PortfolioTabs";
import { LeftPanel } from "./LeftPanel";
import { PositionsTable } from "./PositionsTable";
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

  const { data: portfolios = initialPortfolios } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: listPortfolios,
    initialData: initialPortfolios,
    initialDataUpdatedAt: Date.now(),
    staleTime: 30_000,
  });

  const { data: summary, isLoading: isSummaryLoading, dataUpdatedAt } =
    usePortfolioSummary(activePortfolioId);

  // Handle case when activePortfolioId is null but portfolios exist
  useEffect(() => {
    if (activePortfolioId === null && portfolios.length > 0) {
      setActivePortfolioId(portfolios[0].id);
    }
  }, [portfolios, activePortfolioId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <h1 className="text-xl font-semibold text-white">Investimentos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewPortfolio(true)}
            className="px-3 py-1.5 text-sm bg-[var(--navy)] text-white rounded-lg hover:bg-blue-700"
          >
            + Portfólio
          </button>
          <button
            onClick={() => setShowAddPosition(true)}
            disabled={!activePortfolioId}
            className="px-3 py-1.5 text-sm bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Ativo
          </button>
          <button
            onClick={() => { setDefaultTransactionPositionId(undefined); setShowNewTransaction(true); }}
            disabled={!activePortfolioId}
            className="px-3 py-1.5 text-sm bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Transação
          </button>
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
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
          <LayoutDashboard className="w-12 h-12 text-neutral-600" />
          <p>Nenhum portfólio encontrado.</p>
          <button
            onClick={() => setShowNewPortfolio(true)}
            className="px-4 py-2 bg-[var(--navy)] text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Criar Portfólio
          </button>
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
            <PositionsTable
              positions={summary?.positions ?? []}
              isLoading={isSummaryLoading}
              onAddTransaction={(positionId, _ticker) => {
                setDefaultTransactionPositionId(positionId);
                setShowNewTransaction(true);
              }}
            />
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
