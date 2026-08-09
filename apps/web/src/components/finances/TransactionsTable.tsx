"use client";

import { ArrowLeftRight, Pencil, Repeat, Trash2 } from "lucide-react";
import { FinanceTransaction, TransactionSource } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";

/** Só o que não é digitado à mão ganha rótulo — marcar todo lançamento
 * poluiria a tabela, e "manual" é o caso comum. */
const SOURCE_LABELS: Partial<Record<TransactionSource, string>> = {
  import_ofx: "OFX",
  import_csv: "CSV",
  card_invoice: "Fatura",
};

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
            <th className="px-2 py-2 font-medium">Conta</th>
            <th className="px-2 py-2 font-medium text-right">Valor</th>
            <th className="px-2 py-2 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const isExpense = txn.transaction_type === "expense";
            const isTransfer = txn.transaction_type === "transfer";
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
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {txn.description || "—"}
                    {txn.is_recurring && (
                      <span title={txn.is_virtual ? "Ocorrência projetada" : "Recorrente"}>
                        <Repeat size={12} className="text-[var(--text-muted)]" />
                      </span>
                    )}
                    {isTransfer && (
                      <span title="Transferência entre contas">
                        <ArrowLeftRight size={12} className="text-[var(--text-muted)]" />
                      </span>
                    )}
                    {txn.installment_total && txn.installment_total > 1 && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border)] rounded px-1">
                        {txn.installment_no}/{txn.installment_total}
                      </span>
                    )}
                    {txn.source === "manual" ? (
                      <span
                        className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1"
                        title="Lançado manualmente"
                      >
                        Manual
                      </span>
                    ) : (
                      SOURCE_LABELS[txn.source] && (
                        <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1">
                          {SOURCE_LABELS[txn.source]}
                        </span>
                      )
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
                <td className="px-2 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                  {isTransfer && txn.to_bank_account_name
                    ? `${txn.bank_account_name ?? "—"} → ${txn.to_bank_account_name}`
                    : txn.bank_account_name || "—"}
                </td>
                <td
                  className={`px-2 py-2 text-right font-mono whitespace-nowrap ${
                    isTransfer
                      ? "text-[var(--text-secondary)]"
                      : isExpense
                        ? "text-[var(--danger)]"
                        : "text-[var(--accent)]"
                  }`}
                >
                  {isTransfer ? "" : isExpense ? "−" : "+"}
                  {formatBRLExact(Number(txn.amount))}
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
