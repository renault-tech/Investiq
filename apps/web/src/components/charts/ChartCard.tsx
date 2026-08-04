"use client";

import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  isLoading?: boolean;
  isEmpty?: boolean;
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
