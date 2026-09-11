"use client";

import { TrendingUp } from "lucide-react";
import type { CategorySummary } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { useBudgets, useUpsertBudget } from "@/hooks/useBudgets";
import { useMask } from "@/hooks/useMask";
import { projectMonthlyPct, projectMonthlyValue } from "@/lib/budget-projection";

interface ProjectionCardProps {
  expense: number;
  byCategory: CategorySummary[];
}

/** Sugestão acionável quando a projeção do mês estoura o orçamento: aponta
 * a maior categoria de gasto e, com um clique, cria (ou reduz) o orçamento
 * dela pro que falta pra fechar no azul. O backend só tem orçamento
 * mensal — "limite semanal" do design virou "orçamento pra essa categoria"
 * pra não prometer um recurso que não existe. */
export function ProjectionCard({ expense, byCategory }: ProjectionCardProps) {
  const { data: budgets = [] } = useBudgets();
  const upsertBudget = useUpsertBudget();
  const mask = useMask();

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  const projected = projectMonthlyValue(expense);
  const projectedPct = projectMonthlyPct(expense, totalBudget);
  const overshoot = projectedPct != null && projectedPct > 100 ? projected - totalBudget : 0;

  const topCategory = byCategory.filter((c) => c.category_id).slice().sort((a, b) => Number(b.value) - Number(a.value))[0];
  const topCategoryBudget = topCategory ? budgets.find((b) => b.category_id === topCategory.category_id) : undefined;
  // Sugestão de novo teto: gasto atual da categoria menos a folga que falta
  // fechar no mês — nunca abaixo do que já foi gasto, senão a sugestão
  // criaria um orçamento já estourado no mesmo clique.
  const suggestedAmount = topCategory
    ? Math.max(Number(topCategory.value), (topCategoryBudget ? Number(topCategoryBudget.amount) : Number(topCategory.value)) - overshoot)
    : 0;

  const handleCreateLimit = () => {
    if (!topCategory?.category_id) return;
    upsertBudget.mutate({ categoryId: topCategory.category_id, amount: Math.round(suggestedAmount) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-[var(--text-primary)]">Projeção do mês</div>
        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-md" style={{ background: "var(--glow)", color: "var(--accent)" }}>
          Base
        </span>
      </div>
      <p className="text-[11px] text-[var(--text-muted)] mb-3">Se o ritmo continuar até o fim do mês</p>
      <div className="flex items-center justify-between text-[12.5px] py-1.5 border-b border-[var(--border)]">
        <span className="flex items-center gap-1.5 text-[var(--text-secondary)]"><TrendingUp size={13} /> Gasto projetado</span>
        <b className="font-semibold" style={{ color: overshoot > 0 ? "var(--danger)" : "var(--text-primary)" }}>{mask(formatBRLExact(projected))}</b>
      </div>
      {totalBudget > 0 && (
        <>
          <div className="flex items-center justify-between text-[12.5px] py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-secondary)]">Orçamento</span>
            <b className="font-semibold text-[var(--text-primary)]">{mask(formatBRLExact(totalBudget))}</b>
          </div>
          <div className="flex items-center justify-between text-[12.5px] py-1.5">
            <span className="text-[var(--text-secondary)]">Diferença</span>
            <b className="font-semibold" style={{ color: overshoot > 0 ? "var(--danger)" : "var(--accent)" }}>
              {overshoot > 0 ? `-${mask(formatBRLExact(overshoot))}` : "dentro do previsto"}
            </b>
          </div>
        </>
      )}
      {overshoot > 0 && topCategory?.category_id && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-[11.5px] text-[var(--text-secondary)] mb-2">
            Para fechar no azul, dá pra segurar {mask(formatBRLExact(overshoot))} em {topCategory.category_name}.
            Quer que eu ajuste o orçamento dessa categoria?
          </p>
          <button
            onClick={handleCreateLimit}
            disabled={upsertBudget.isPending}
            className="px-3.5 py-2 text-[12.5px] font-medium rounded-[10px] hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {upsertBudget.isPending ? "Ajustando…" : `Ajustar limite de ${topCategory.category_name}`}
          </button>
        </div>
      )}
    </div>
  );
}
