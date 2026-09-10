"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, ArrowUpDown, CheckCircle2, CircleDollarSign, Pencil, Repeat, RotateCcw, Tag, Trash2 } from "lucide-react";
import { FinanceTransaction, TransactionSource } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";

/** Versão com ordenação por coluna e seleção múltipla + ações em lote —
 * mesma tabela, mesmas colunas e mesmo comportamento de linha de
 * TransactionsTable.tsx original; só adiciona:
 *   1. cabeçalho clicável (ordena por data, descrição ou valor)
 *   2. checkbox por linha + checkbox "selecionar tudo" no cabeçalho
 *   3. barra de ações em lote quando 1+ linha está selecionada
 * onBulkPay/onBulkDelete/onBulkCategorize ficam a cargo de quem monta a
 * tela (FinancesClient/TransactionsClient) — aqui só emite os ids
 * selecionados, sem saber COMO a ação é executada. */

const SOURCE_LABELS: Partial<Record<TransactionSource, string>> = {
  import_ofx: "OFX",
  import_csv: "CSV",
  card_invoice: "Fatura",
};

type SortKey = "due_date" | "description" | "amount";
type SortDir = "asc" | "desc";

interface TransactionsTableProps {
  transactions: FinanceTransaction[];
  isLoading: boolean;
  onEdit: (txn: FinanceTransaction) => void;
  onDelete: (txn: FinanceTransaction) => void;
  onPay: (txn: FinanceTransaction) => void;
  onUnpay: (txn: FinanceTransaction) => void;
  onRowClick?: (txn: FinanceTransaction) => void;
  selectedId?: string | null;
  /** Ações em lote — opcionais: sem elas, a tabela some com a coluna de
   * seleção e volta a se comportar como a versão original. */
  onBulkPay?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkCategorize?: (ids: string[]) => void;
}

export function hasCheckableStatus(txn: FinanceTransaction): boolean {
  return (
    txn.is_recurring ||
    txn.is_recurring_occurrence ||
    txn.is_virtual ||
    txn.due_date.slice(0, 10) !== txn.transaction_date.slice(0, 10)
  );
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 font-medium hover:text-[var(--text-primary)]">
      {label}
      <ArrowUpDown size={11} className={active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"} style={{ transform: active && dir === "asc" ? "scaleY(-1)" : undefined }} />
    </button>
  );
}

export function TransactionsTable({
  transactions, isLoading, onEdit, onDelete, onPay, onUnpay, onRowClick, selectedId,
  onBulkPay, onBulkDelete, onBulkCategorize,
}: TransactionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulkEnabled = !!(onBulkPay || onBulkDelete || onBulkCategorize);

  const sorted = useMemo(() => {
    const rows = [...transactions];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "due_date") cmp = a.due_date.localeCompare(b.due_date);
      else if (sortKey === "description") cmp = (a.description ?? "").localeCompare(b.description ?? "");
      else cmp = Number(a.amount) - Number(b.amount);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [transactions, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }
  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === sorted.length ? new Set() : new Set(sorted.map((t) => t.id))));
  }
  function runBulk(fn?: (ids: string[]) => void) {
    if (!fn || selected.size === 0) return;
    fn(Array.from(selected));
    setSelected(new Set());
  }

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
    <div>
      {bulkEnabled && selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg bg-[var(--glow)] border border-[var(--accent)]">
          <span className="text-[12.5px] font-medium text-[var(--text-primary)]">{selected.size} selecionada(s)</span>
          <div className="flex items-center gap-1.5 ml-auto">
            {onBulkPay && (
              <button onClick={() => runBulk(onBulkPay)} className="flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium rounded-md" style={{ color: "var(--accent)", background: "var(--surface)" }}>
                <CircleDollarSign size={12} /> Marcar pagas
              </button>
            )}
            {onBulkCategorize && (
              <button onClick={() => runBulk(onBulkCategorize)} className="flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium rounded-md bg-[var(--surface)] text-[var(--text-secondary)]">
                <Tag size={12} /> Categorizar
              </button>
            )}
            {onBulkDelete && (
              <button onClick={() => runBulk(onBulkDelete)} className="flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium rounded-md bg-[var(--surface)] text-[var(--danger)]">
                <Trash2 size={12} /> Excluir
              </button>
            )}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
              {bulkEnabled && (
                <th className="px-2 py-2 w-8">
                  <input type="checkbox" checked={selected.size === sorted.length} onChange={toggleAll} aria-label="Selecionar todas" />
                </th>
              )}
              <th className="px-2 py-2"><SortHeader label="Lançamento" active={sortKey === "due_date"} dir={sortDir} onClick={() => toggleSort("due_date")} /></th>
              <th className="px-2 py-2 font-medium">Vencimento</th>
              <th className="px-2 py-2"><SortHeader label="Descrição" active={sortKey === "description"} dir={sortDir} onClick={() => toggleSort("description")} /></th>
              <th className="px-2 py-2 font-medium">Categoria</th>
              <th className="px-2 py-2 font-medium">Conta</th>
              <th className="px-2 py-2 text-right"><SortHeader label="Valor" active={sortKey === "amount"} dir={sortDir} onClick={() => toggleSort("amount")} /></th>
              <th className="px-2 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((txn) => {
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
                  {bulkEnabled && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(txn.id)} onChange={() => toggleOne(txn.id)} aria-label={`Selecionar ${txn.description ?? "transação"}`} />
                    </td>
                  )}
                  <td className="px-2 py-2 whitespace-nowrap text-[var(--text-secondary)] font-mono text-xs">
                    {new Date(txn.transaction_date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap font-mono text-xs">
                    {hasCheckableStatus(txn) ? (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: txn.is_paid ? "var(--accent)" : "var(--danger)" }}
                        title={txn.is_paid ? (txn.paid_at ? `Pago em ${new Date(txn.paid_at).toLocaleDateString("pt-BR")}` : "Pago") : `Vence em ${new Date(txn.due_date).toLocaleDateString("pt-BR")}`}
                      >
                        {txn.is_paid && <CheckCircle2 size={11} />}
                        {new Date(txn.due_date).toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-[var(--text-primary)]">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {txn.description || "—"}
                      {txn.is_recurring && <span title={txn.is_virtual ? "Ocorrência projetada" : "Recorrente"}><Repeat size={12} className="text-[var(--text-muted)]" /></span>}
                      {isTransfer && <span title="Transferência entre contas"><ArrowLeftRight size={12} className="text-[var(--text-muted)]" /></span>}
                      {txn.installment_total && txn.installment_total > 1 && (
                        <span className="text-[10px] font-mono text-[var(--text-muted)] border border-[var(--border)] rounded px-1">{txn.installment_no}/{txn.installment_total}</span>
                      )}
                      {txn.source === "manual" ? (
                        <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1" title="Lançado manualmente">Manual</span>
                      ) : (
                        SOURCE_LABELS[txn.source] && <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1">{SOURCE_LABELS[txn.source]}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {txn.category_name ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border border-[var(--border)] text-[var(--text-secondary)]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: txn.category_color ?? "#94A3B8" }} />
                        {txn.category_name}
                      </span>
                    ) : <span className="text-xs text-[var(--text-muted)]">—</span>}
                  </td>
                  <td className="px-2 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    {isTransfer && txn.to_bank_account_name ? `${txn.bank_account_name ?? "—"} → ${txn.to_bank_account_name}` : txn.bank_account_name || "—"}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono whitespace-nowrap ${isTransfer ? "text-[var(--text-secondary)]" : isExpense ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>
                    {isTransfer ? "" : isExpense ? "−" : "+"}{formatBRLExact(Number(txn.amount))}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {!txn.is_paid && (
                      <button onClick={(e) => { e.stopPropagation(); onPay(txn); }} className="inline-flex items-center gap-1 px-1.5 py-1 mr-1 text-[11px] font-medium rounded-md" style={{ color: "var(--accent)", background: "var(--glow)" }} aria-label={`Marcar ${txn.description ?? "transação"} como paga`}>
                        <CircleDollarSign size={13} /> Pagar
                      </button>
                    )}
                    {txn.is_paid && hasCheckableStatus(txn) && (
                      <button onClick={(e) => { e.stopPropagation(); onUnpay(txn); }} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label={`Desfazer confirmação de ${txn.description ?? "transação"}`} title="Desfazer confirmação">
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onEdit(txn); }} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label={`Editar ${txn.description ?? "transação"}`}>
                      <Pencil size={14} />
                    </button>
                    {!txn.is_virtual && (
                      <button onClick={(e) => { e.stopPropagation(); onDelete(txn); }} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)]" aria-label={`Excluir ${txn.description ?? "transação"}`}>
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
    </div>
  );
}

// Nada muda em quem já usa <TransactionsTable ...> sem as props de bulk —
// a coluna de checkbox e a barra de ações só aparecem se onBulkPay/
// onBulkDelete/onBulkCategorize forem passadas. Pra ativar em
// TransactionsClient.tsx, implementar os três handlers chamando os hooks
// de mutação já existentes (useDeleteTransaction, pay/unpay) em loop pelos
// ids recebidos, e passar como props.
