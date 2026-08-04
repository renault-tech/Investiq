"use client";

import { Pencil, Repeat, Trash2 } from "lucide-react";
import { FinanceTransaction } from "@/lib/finance-api";
import { formatBRL } from "@/components/charts/chartTheme";

interface TransactionsTableProps {
  transactions: FinanceTransaction[];
  isLoading: boolean;
  onEdit: (txn: FinanceTransaction) => void;
  onDelete: (txn: FinanceTransaction) => void;
}

export function TransactionsTable({ transactions, isLoading, onEdit, onDelete }: TransactionsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        <p className="font-medium">Nenhuma transação no período.</p>
        <p className="text-sm mt-1">Registre sua primeira receita ou despesa.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
            <th className="px-2 py-2 font-medium">Data</th>
            <th className="px-2 py-2 font-medium">Descrição</th>
            <th className="px-2 py-2 font-medium">Categoria</th>
            <th className="px-2 py-2 font-medium text-right">Valor</th>
            <th className="px-2 py-2 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const isExpense = txn.transaction_type === "expense";
            return (
              <tr
                key={txn.id}
                className={`border-b border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                  txn.is_virtual ? "opacity-60" : ""
                }`}
              >
                <td className="px-2 py-2 whitespace-nowrap text-[var(--text-secondary)] font-mono text-xs">
                  {new Date(txn.transaction_date).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-2 py-2 text-[var(--text-primary)]">
                  <span className="flex items-center gap-1.5">
                    {txn.description || "—"}
                    {txn.is_recurring && (
                      <span title={txn.is_virtual ? "Ocorrência projetada" : "Recorrente"}>
                        <Repeat size={12} className="text-[var(--text-muted)]" />
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-2 py-2">
                  {txn.category_name ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border border-[var(--border)] text-[var(--text-secondary)]"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: txn.category_color ?? "#94A3B8" }}
                      />
                      {txn.category_name}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td
                  className={`px-2 py-2 text-right font-mono whitespace-nowrap ${
                    isExpense ? "text-[var(--danger)]" : "text-[var(--accent)]"
                  }`}
                >
                  {isExpense ? "−" : "+"}
                  {formatBRL(Number(txn.amount))}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  {!txn.is_virtual && (
                    <>
                      <button
                        onClick={() => onEdit(txn)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        aria-label={`Editar ${txn.description ?? "transação"}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(txn)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)]"
                        aria-label={`Excluir ${txn.description ?? "transação"}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
