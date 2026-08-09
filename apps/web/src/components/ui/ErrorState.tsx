"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/** Distinguishes "the request failed" from an empty result — without this,
 * a fetch failure and "you have no data yet" look identical to the user,
 * which is actively misleading in an app that shows financial numbers. */
export function ErrorState({
  title = "Não foi possível carregar os dados.",
  description = "Verifique sua conexão e tente novamente.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-[var(--text-muted)]">
      <AlertTriangle size={28} className="text-[var(--danger)]" />
      <div>
        <p className="font-medium text-[var(--text-secondary)]">{title}</p>
        {description && <p className="text-sm mt-1">{description}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--navy)] dark:text-[var(--accent)] hover:underline"
        >
          <RefreshCw size={14} /> Tentar de novo
        </button>
      )}
    </div>
  );
}
