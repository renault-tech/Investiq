"use client";

import { useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { useBudgets, useUpsertBudget, useDeleteBudget } from "@/hooks/useBudgets";
import { FinanceCategory } from "@/lib/finance-api";
import { formatBRL } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";

interface BudgetsSectionProps {
  categories: FinanceCategory[];
}

function barColor(pctUsed: number): string {
  if (pctUsed > 1) return "bg-[var(--danger)]";
  if (pctUsed > 0.8) return "bg-[var(--warning)]";
  return "bg-[var(--accent)]";
}

export function BudgetsSection({ categories }: BudgetsSectionProps) {
  const { data: budgets = [] } = useBudgets();
  const upsertMutation = useUpsertBudget();
  const deleteMutation = useDeleteBudget();

  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id));
  const availableCategories = categories.filter(
    (c) => c.category_type === "expense" && c.is_active && !budgetedCategoryIds.has(c.id)
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!categoryId || !value || value <= 0) return;
    await upsertMutation.mutateAsync({ categoryId, amount: value });
    setCategoryId("");
    setAmount("");
    setShowForm(false);
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
          <Wallet size={15} /> Orçamentos
        </h3>
        {availableCategories.length > 0 && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 text-xs text-[var(--navy)] dark:text-[var(--accent)] hover:underline"
          >
            <Plus size={13} /> Novo orçamento
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-end gap-2 mb-4 pb-4 border-b border-[var(--border)]">
          <div className="flex-1">
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--text-primary)]"
            >
              <option value="">Selecione</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">Valor mensal (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-28 px-2 py-1.5 text-xs border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--text-primary)] font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={upsertMutation.isPending}
            className="px-3 py-1.5 text-xs bg-[var(--navy)] text-white rounded-md hover:opacity-90 disabled:opacity-50"
          >
            Salvar
          </button>
        </form>
      )}

      {budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum orçamento definido."
          description="Defina um limite mensal por categoria para acompanhar seus gastos."
        />
      ) : (
        <ul className="space-y-3">
          {budgets.map((budget) => {
            const pct = Math.min(Number(budget.pct_used) * 100, 100);
            return (
              <li key={budget.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-[var(--text-primary)] font-medium">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: budget.category_color ?? "#94A3B8" }}
                    />
                    {budget.category_name}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[var(--text-secondary)]">
                    {formatBRL(Number(budget.spent))} / {formatBRL(Number(budget.amount))}
                    <button
                      onClick={() => deleteMutation.mutate(budget.category_id)}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                      aria-label={`Remover orçamento de ${budget.category_name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(Number(budget.pct_used))}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
