"use client";

import { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ChartCardProps {
  title: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  /** True when the query that feeds this card failed — rendered distinctly
   * from isEmpty so "the request failed" never looks like "no data yet". */
  isError?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Altura da área do gráfico (o skeleton usa a mesma, evitando layout shift). */
  height?: number;
}

export function ChartCard({
  title,
  isLoading = false,
  isEmpty = false,
  isError = false,
  onRetry,
  emptyMessage = "Sem dados para exibir.",
  actions,
  children,
  height = 260,
}: ChartCardProps) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-sm dark:shadow-none p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      <div style={{ height }} className="relative">
        {isLoading ? (
          <div className="absolute inset-0 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ) : isError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-sm text-[var(--text-muted)] px-4">
            <AlertTriangle size={20} className="text-[var(--danger)]" />
            <span>Não foi possível carregar.</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--navy)] dark:text-[var(--accent)] hover:underline"
              >
                <RefreshCw size={12} /> Tentar de novo
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-muted)]">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
