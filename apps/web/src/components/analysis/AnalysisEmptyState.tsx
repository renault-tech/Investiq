"use client";

import { BarChart2 } from "lucide-react";

interface AnalysisEmptyStateProps {
  onAnalyze?: () => void;
  disabled?: boolean;
}

export function AnalysisEmptyState({ onAnalyze, disabled }: AnalysisEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
        <BarChart2 size={32} className="text-[var(--text-muted)]" />
      </div>
      <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
        Nenhuma análise disponível
      </h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
        Selecione um portfólio e clique abaixo para gerar uma análise aprofundada baseada em IA sobre seus investimentos.
      </p>
      {onAnalyze && (
        <button
          onClick={onAnalyze}
          disabled={disabled}
          className="bg-[var(--navy)] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Gerar Análise
        </button>
      )}
    </div>
  );
}
