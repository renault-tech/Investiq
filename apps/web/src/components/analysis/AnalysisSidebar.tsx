"use client";

import { useAnalyses } from "@/hooks/useAnalyses";

interface AnalysisSidebarProps {
  portfolioId: string | null;
  activeAnalysisId: string | null;
  onSelect: (id: string) => void;
}

export function AnalysisSidebar({ portfolioId, activeAnalysisId, onSelect }: AnalysisSidebarProps) {
  const { data: analyses, isLoading } = useAnalyses(portfolioId);

  const formatShortDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', { 
        day: '2-digit', month: 'short' 
      }).format(date);
    } catch {
      return dateString.substring(0, 10);
    }
  };

  if (!portfolioId) {
    return (
      <div className="w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col hidden md:flex">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Histórico</h3>
        <p className="text-xs text-[var(--text-muted)]">Selecione um portfólio primeiro.</p>
      </div>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col hidden md:flex">
      <div className="p-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Histórico de Análises</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && (
          <div className="p-2 text-xs text-[var(--text-muted)]">Carregando histórico...</div>
        )}
        
        {!isLoading && analyses?.length === 0 && (
          <div className="p-2 text-xs text-[var(--text-muted)] text-center mt-4">
            Nenhuma análise anterior.
          </div>
        )}

        {!isLoading && analyses?.map((item) => {
          const isActive = activeAnalysisId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex flex-col gap-1 ${
                isActive
                  ? "bg-[var(--navy)] dark:bg-slate-700 text-white"
                  : "text-[var(--text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <span className={`text-xs font-medium ${isActive ? "text-white" : "text-[var(--text-primary)]"}`}>
                  {formatShortDate(item.created_at)}
                </span>
              </div>
              <p className={`text-[11px] truncate w-full ${isActive ? "text-slate-300" : "text-[var(--text-muted)]"}`}>
                {item.summary_snippet || "Sem resumo disponível"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
