"use client";

import { useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { useBudgets, useUpsertBudget, useDeleteBudget } from "@/hooks/useBudgets";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinanceScopeStore } from "@/store/useFinanceScopeStore";
import { FinanceCategory } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { parseBRNumber } from "@/lib/number-format";

interface BudgetsSectionProps {
  categories: FinanceCategory[];
  /** Sem o cartão próprio (borda/sombra/padding) — para quando o pai já
   * embrulha isto num DashboardCard da grade ajustável (Finanças). */
  bare?: boolean;
}

export function BudgetsSection({ categories, bare = false }: BudgetsSectionProps) {
  const { data: budgets = [] } = useBudgets();
  const upsertMutation = useUpsertBudget();
  const deleteMutation = useDeleteBudget();
  const activeAccountId = useFinanceScopeStore((s) => s.activeAccountId);
  const { data: accounts = [] } = useAccounts();
  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id));
  const availableCategories = categories.filter(
    (c) => c.category_type === "expense" && c.is_active && !budgetedCategoryIds.has(c.id)
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseBRNumber(amount);
    if (!categoryId || !value || value <= 0) return;
    await upsertMutation.mutateAsync({ categoryId, amount: value });
    setCategoryId("");
    setAmount("");
    setShowForm(false);
  };

  return (
    <div className={bare ? "" : "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card-sm)] p-5 shadow-[var(--shadow)]"}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
            <Wallet size={15} /> Orçamentos
          </h3>
          {/* Cada carteira tem seus próprios tetos, então sem dizer de quem é
              o teto exibido o número fica ambíguo ao trocar de carteira. */}
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {activeAccount ? activeAccount.name : "Consolidado · todas as carteiras"}
          </p>
        </div>
        {availableCategories.length > 0 && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 py-1.5 text-xs text-[var(--accent)] hover:underline"
          >
            <Plus size={13} /> Novo orçamento
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex items-end gap-2 mb-4 pb-4 border-b border-[var(--border)]">
          <Select
            label="Categoria"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1"
          >
            <option value="">Selecione</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Input
            label="Valor mensal (R$)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="w-28 font-mono"
          />
          <Button type="submit" size="sm" loading={upsertMutation.isPending}>
            Salvar
          </Button>
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
            const pctUsed = Number(budget.pct_used);
            const pct = Math.min(pctUsed * 100, 100);
            const overrun = pctUsed > 1;
            const color = budget.category_color ?? "var(--accent)";
            return (
              <li key={budget.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-[var(--text-primary)] font-medium">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {budget.category_name}
                  </span>
                  <span className="flex items-center gap-2 font-mono" style={{ color: overrun ? "var(--danger)" : "var(--text-secondary)" }}>
                    {formatBRLExact(Number(budget.spent))} / {formatBRLExact(Number(budget.amount))}
                    <button
                      onClick={() => deleteMutation.mutate(budget.category_id)}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                      aria-label={`Remover orçamento de ${budget.category_name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      // Estoura o orçamento: hachura por cima da cor da categoria em vez
                      // de trocar a cor inteira — a cor identifica a categoria em toda
                      // a tela, então não pode virar sinalização de status aqui.
                      background: overrun
                        ? `repeating-linear-gradient(135deg, ${color}, ${color} 4px, var(--danger) 4px, var(--danger) 8px)`
                        : color,
                    }}
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
