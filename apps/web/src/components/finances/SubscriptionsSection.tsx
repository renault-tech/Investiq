"use client";

import { CreditCard } from "lucide-react";
import type { FinanceTransaction } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";

interface SubscriptionsSectionProps {
  transactions: FinanceTransaction[];
}

/** "Assinaturas e recorrentes" a partir de lançamentos já marcados como
 * recorrentes (recurrence_rule numa série, ou is_recurring_occurrence numa
 * ocorrência gerada dela) — sem heurística de detecção: o backend já sabe
 * quais são recorrentes, só faltava juntar numa lista própria. Deduplicado
 * por descrição porque a mesma assinatura aparece uma vez por mês na lista
 * de transações do mês corrente. */
export function SubscriptionsSection({ transactions }: SubscriptionsSectionProps) {
  const recurring = transactions.filter(
    (t) => t.transaction_type === "expense" && (t.recurrence_rule || t.is_recurring_occurrence)
  );
  const byDescription = new Map<string, FinanceTransaction>();
  for (const t of recurring) {
    const key = (t.description ?? t.category_name ?? "Assinatura").trim().toLowerCase();
    const existing = byDescription.get(key);
    if (!existing || new Date(t.due_date) < new Date(existing.due_date)) byDescription.set(key, t);
  }
  const items = Array.from(byDescription.values()).sort((a, b) => Number(b.amount) - Number(a.amount));
  const total = items.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-semibold text-[var(--text-primary)]">Assinaturas e recorrentes</div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={CreditCard} title="Nenhuma assinatura ainda" description="Marque um lançamento como recorrente para vê-lo aqui." />
      ) : (
        <>
          <p className="text-[11px] text-[var(--text-muted)] mb-3">
            {formatBRLExact(total)} por mês · {items.length} ativa{items.length > 1 ? "s" : ""}
          </p>
          <ul className="flex flex-col gap-2.5">
            {items.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[var(--surface-3)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-secondary)] flex-shrink-0">
                  {(t.description ?? t.category_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate text-[var(--text-primary)]">{t.description ?? t.category_name}</div>
                  <div className="text-[10.5px] text-[var(--text-muted)]">
                    renova {new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </div>
                </div>
                <span className="text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">{formatBRLExact(Number(t.amount))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
