"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string, opts: { short?: boolean } = {}): string {
  const [year, mon] = month.split("-").map(Number);
  const label = new Date(year, mon - 1, 1).toLocaleDateString("pt-BR", {
    month: opts.short ? "short" : "long",
    year: "numeric",
  });
  // toLocaleDateString capitaliza cada palavra ("Agosto De 2026"); em
  // português só a inicial leva maiúscula.
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface MonthStepperProps {
  month: string;
  onShift: (delta: number) => void;
  /** Compacto para usar no meio da tela, ao lado de filtros. */
  compact?: boolean;
}

/** Passar de mês. Aparece no topo da tela e de novo junto da lista de
 * lançamentos: a lista é longa, e ter que voltar ao topo só para trocar o
 * mês que ela mostra é o tipo de ida e volta que a tela inteira existe pra
 * evitar. As duas instâncias controlam o mesmo estado — o rótulo do
 * compacto usa palavras diferentes (não só um sufixo) porque a checagem de
 * nome acessível do Playwright/Testing Library é por substring: um sufixo
 * ainda deixaria "Próximo mês" batendo nos dois botões. */
export function MonthStepper({ month, onShift, compact = false }: MonthStepperProps) {
  const prevLabel = compact ? "Voltar um mês" : "Mês anterior";
  const nextLabel = compact ? "Avançar um mês" : "Próximo mês";
  return (
    <div
      className={`flex items-center gap-1 ${
        compact
          ? "rounded-lg border border-[var(--border)] bg-[var(--background)] px-1"
          : ""
      }`}
    >
      <button
        onClick={() => onShift(-1)}
        aria-label={prevLabel}
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronLeft size={compact ? 14 : 16} />
      </button>
      <span
        className={
          compact
            ? "text-[11.5px] font-medium text-[var(--text-secondary)] min-w-[104px] text-center tabular-nums"
            : "text-[13px] font-medium text-[var(--text-primary)] min-w-[132px] text-center"
        }
      >
        {monthLabel(month, { short: compact })}
      </span>
      <button
        onClick={() => onShift(1)}
        aria-label={nextLabel}
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <ChevronRight size={compact ? 14 : 16} />
      </button>
    </div>
  );
}
