"use client";

import { ArrowLeftRight, CheckCircle2, CircleDollarSign, Pencil, Repeat, RotateCcw, Trash2 } from "lucide-react";
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
  onPay: (txn: FinanceTransaction) => void;
  onUnpay: (txn: FinanceTransaction) => void;
  /** Drill-down opcional: quando presente, a linha vira clicável (fora dos
   * botões de ação) e destaca a transação selecionada. */
  onRowClick?: (txn: FinanceTransaction) => void;
  selectedId?: string | null;
}

/** Lançamento comum, pago no mesmo dia, não precisa de selo nem de botão de
 * confirmação — só quando "pago" é uma pergunta de verdade (recorrência,
 * ocorrência projetada, ou vencimento diferente da data de lançamento) que
 * vale a poluição visual de mostrar o estado e deixar trocá-lo. */
export function hasCheckableStatus(txn: FinanceTransaction): boolean {
  // is_recurring_occurrence cobre a série em si e qualquer ocorrência já
  // materializada dela (paga/editada) — sem isso, pagar uma ocorrência a
  // "desligava" de is_recurring e o selo/Desfazer sumiam da hora pra noite.
  return (
    txn.is_recurring ||
    txn.is_recurring_occurrence ||
    txn.is_virtual ||
    txn.due_date.slice(0, 10) !== txn.transaction_date.slice(0, 10)
  );
}

export function TransactionsTable({ transactions, isLoading, onEdit, onDelete, onPay, onUnpay, onRowClick, selectedId }: TransactionsTableProps) {
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
                onClick={onRowClick ? () => onRowClick(txn) : undefined}
                className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)] ${
                  txn.is_virtual ? "opacity-60" : ""
                } ${onRowClick ? "cursor-pointer" : ""} ${selectedId === txn.id ? "bg-[var(--surface-2)]" : ""}`}
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
                    {/* Vence/Pago só aparece pra lançamento com cara de conta a pagar
                        (recorrente, ocorrência projetada, ou vencimento diferente da
                        data de lançamento) — numa transação comum, lançada e paga no
                        mesmo dia, o selo seria óbvio demais pra valer a poluição visual. */}
                    {hasCheckableStatus(txn) && (
                      txn.is_paid ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] rounded px-1 border"
                          style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
                          title={txn.paid_at ? `Pago em ${new Date(txn.paid_at).toLocaleDateString("pt-BR")}` : "Pago"}
                        >
                          <CheckCircle2 size={10} /> Pago
                        </span>
                      ) : (
                        <span
                          className="text-[10px] rounded px-1 border"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                          title={`Vence em ${new Date(txn.due_date).toLocaleDateString("pt-BR")}`}
                        >
                          Vence {new Date(txn.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </span>
                      )
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
                  {!txn.is_paid && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onPay(txn); }}
                      className="inline-flex items-center gap-1 px-1.5 py-1 mr-1 text-[11px] font-medium rounded-md"
                      style={{ color: "var(--accent)", background: "var(--glow)" }}
                      aria-label={`Marcar ${txn.description ?? "transação"} como paga`}
                      title={txn.is_virtual ? "Confirma esta ocorrência (materializa a linha)" : undefined}
                    >
                      <CircleDollarSign size={13} /> Pagar
                    </button>
                  )}
                  {txn.is_paid && hasCheckableStatus(txn) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onUnpay(txn); }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      aria-label={`Desfazer confirmação de ${txn.description ?? "transação"}`}
                      title="Desfazer confirmação"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(txn); }}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    aria-label={`Editar ${txn.description ?? "transação"}`}
                    title={txn.is_virtual ? "Editar só esta ocorrência (não muda a série)" : undefined}
                  >
                    <Pencil size={14} />
                  </button>
                  {!txn.is_virtual && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(txn); }}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)]"
                      aria-label={`Excluir ${txn.description ?? "transação"}`}
                    >
                      <Trash2 size={14} />
                    </button>
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
