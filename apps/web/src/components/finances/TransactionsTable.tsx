"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight, ArrowUpDown, CheckCircle2, CircleDollarSign, Pencil, Repeat, RotateCcw, Tag, Trash2,
} from "lucide-react";
import { FinanceTransaction, TransactionSource } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";

/** Só o que não é digitado à mão ganha rótulo — marcar todo lançamento
 * poluiria a tabela, e "manual" é o caso comum. */
const SOURCE_LABELS: Partial<Record<TransactionSource, string>> = {
  import_ofx: "OFX",
  import_csv: "CSV",
  card_invoice: "Fatura",
};

export type SortKey = "due_date" | "transaction_date" | "description" | "amount";
export type SortDir = "asc" | "desc";

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
  /** Ações em lote — opcionais. Sem nenhuma delas a coluna de checkbox e a
   * barra de ações não aparecem, e a tabela se comporta como antes; é o que
   * mantém os dois consumidores atuais funcionando sem alteração. */
  onBulkPay?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkCategorize?: (ids: string[]) => void;
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

/** Ordenação das colunas clicáveis, fora do componente para poder ser
 * testada direto.
 *
 * `due_date` e `transaction_date` são chaves distintas de propósito: a coluna
 * "Lançamento" exibe `transaction_date` e a "Vencimento" exibe `due_date` —
 * são datas diferentes sempre que o vencimento não cai no mesmo dia do
 * lançamento (recorrência, parcela, ocorrência projetada). Ligar o cabeçalho
 * "Lançamento" a `due_date` ordenaria por uma coluna que não é a que aparece
 * embaixo dele. `due_date` continua existindo como chave só para o `sortKey`
 * inicial, que replica a ordem padrão da API (`service.py` list_transactions,
 * `due_date.desc()`) sem depender de nenhum cabeçalho estar "ativo".
 *
 * O `Number()` em `amount` é defensivo: hoje `listTransactions` já coage o
 * Decimal-como-string na fronteira (finance-api.ts:140), então aqui chega
 * número. Se essa coerção sumir, ou se algum consumidor passar linhas não
 * coagidas, a comparação lexicográfica poria R$ 900 acima de R$ 1.000 — sem
 * erro de tipo, só a ordem errada na tela. Data em ISO ordena bem como
 * texto. */
export function sortTransactions(
  transactions: FinanceTransaction[],
  key: SortKey,
  dir: SortDir
): FinanceTransaction[] {
  const rows = [...transactions];
  rows.sort((a, b) => {
    let cmp = 0;
    if (key === "due_date") cmp = a.due_date.localeCompare(b.due_date);
    else if (key === "transaction_date") cmp = a.transaction_date.localeCompare(b.transaction_date);
    else if (key === "description") cmp = (a.description ?? "").localeCompare(b.description ?? "");
    else cmp = Number(a.amount) - Number(b.amount);
    return dir === "asc" ? cmp : -cmp;
  });
  return rows;
}

function SortHeader({
  label, active, dir, onClick,
}: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 font-medium hover:text-[var(--text-primary)]"
      aria-label={`Ordenar por ${label}`}
    >
      {label}
      <ArrowUpDown
        size={11}
        className={active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}
        style={{ transform: active && dir === "asc" ? "scaleY(-1)" : undefined }}
      />
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

  const sorted = useMemo(
    () => sortTransactions(transactions, sortKey, sortDir),
    [transactions, sortKey, sortDir]
  );

  // A seleção é derivada do que está na tela, nunca lida direto do Set: trocar
  // de mês ou de filtro troca a lista inteira, e os ids marcados antes
  // continuariam no estado. Sem isto, "3 selecionadas" podia contar linhas que
  // não estão mais visíveis — e a ação em lote iria junto nelas.
  const selectedVisible = useMemo(
    () => sorted.filter((t) => selected.has(t.id)),
    [sorted, selected]
  );
  const todasMarcadas = sorted.length > 0 && selectedVisible.length === sorted.length;

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
    setSelected(todasMarcadas ? new Set() : new Set(sorted.map((t) => t.id)));
  }
  function runBulk(fn: ((ids: string[]) => void) | undefined, txns: FinanceTransaction[]) {
    if (!fn || txns.length === 0) return;
    fn(txns.map((t) => t.id));
    setSelected(new Set());
  }

  // Ocorrência projetada não existe como linha no banco — não há o que
  // excluir. É a mesma razão pela qual o botão Excluir some da linha quando
  // is_virtual; aqui o lote respeita a mesma regra em vez de mandar ids que
  // a API recusaria. Pagar, esse sim, vale para ocorrência projetada (é o
  // que a materializa), então só a exclusão é filtrada.
  const excluiveis = useMemo(() => selectedVisible.filter((t) => !t.is_virtual), [selectedVisible]);

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
      {bulkEnabled && selectedVisible.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg bg-[var(--glow)] border border-[var(--accent)] flex-wrap">
          <span className="text-[12.5px] font-medium text-[var(--text-primary)]">
            {selectedVisible.length} selecionada(s)
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {onBulkPay && (
              <button
                onClick={() => runBulk(onBulkPay, selectedVisible)}
                className="flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium rounded-md"
                style={{ color: "var(--accent)", background: "var(--surface)" }}
              >
                <CircleDollarSign size={12} /> Marcar pagas
              </button>
            )}
            {onBulkCategorize && (
              <button
                onClick={() => runBulk(onBulkCategorize, selectedVisible)}
                className="flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium rounded-md bg-[var(--surface)] text-[var(--text-secondary)]"
              >
                <Tag size={12} /> Categorizar
              </button>
            )}
            {onBulkDelete && (
              <button
                onClick={() => runBulk(onBulkDelete, excluiveis)}
                disabled={excluiveis.length === 0}
                title={
                  excluiveis.length === 0
                    ? "Só ocorrências projetadas selecionadas — não existem como lançamento para excluir."
                    : excluiveis.length < selectedVisible.length
                      ? `Exclui ${excluiveis.length} de ${selectedVisible.length}: ocorrências projetadas não são excluíveis.`
                      : undefined
                }
                className="flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium rounded-md bg-[var(--surface)] text-[var(--danger)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={12} /> Excluir
                {excluiveis.length > 0 && excluiveis.length < selectedVisible.length && ` (${excluiveis.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="density-table w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
              {bulkEnabled && (
                <th className="px-2 py-2 w-8">
                  <input type="checkbox" checked={todasMarcadas} onChange={toggleAll} aria-label="Selecionar todas" />
                </th>
              )}
              <th className="px-2 py-2">
                <SortHeader label="Lançamento" active={sortKey === "transaction_date"} dir={sortDir} onClick={() => toggleSort("transaction_date")} />
              </th>
              <th className="px-2 py-2 font-medium">Vencimento</th>
              <th className="px-2 py-2">
                <SortHeader label="Descrição" active={sortKey === "description"} dir={sortDir} onClick={() => toggleSort("description")} />
              </th>
              <th className="px-2 py-2 font-medium">Categoria</th>
              <th className="px-2 py-2 font-medium">Conta</th>
              <th className="px-2 py-2 text-right">
                <SortHeader label="Valor" active={sortKey === "amount"} dir={sortDir} onClick={() => toggleSort("amount")} />
              </th>
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
                      <input
                        type="checkbox"
                        checked={selected.has(txn.id)}
                        onChange={() => toggleOne(txn.id)}
                        aria-label={`Selecionar ${txn.description ?? "transação"}`}
                      />
                    </td>
                  )}
                  <td className="px-2 py-2 whitespace-nowrap text-[var(--text-secondary)] font-mono text-xs">
                    {new Date(txn.transaction_date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap font-mono text-xs">
                    {/* Só mostra data aqui quando o vencimento é uma pergunta de
                        verdade (recorrência, ocorrência projetada, ou vencimento
                        diferente do lançamento) — um lançamento comum, pago no
                        mesmo dia, não tem vencimento próprio pra mostrar. */}
                    {hasCheckableStatus(txn) ? (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: txn.is_paid ? "var(--accent)" : "var(--danger)" }}
                        title={
                          txn.is_paid
                            ? (txn.paid_at ? `Pago em ${new Date(txn.paid_at).toLocaleDateString("pt-BR")}` : "Pago")
                            : `Vence em ${new Date(txn.due_date).toLocaleDateString("pt-BR")}`
                        }
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
                        <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1" title="Lançado manualmente">
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
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border border-[var(--border)] text-[var(--text-secondary)]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: txn.category_color ?? "#94A3B8" }} />
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
                      isTransfer ? "text-[var(--text-secondary)]" : isExpense ? "text-[var(--danger)]" : "text-[var(--accent)]"
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
                    {/* Ocorrência projetada não existe como linha no banco —
                        não há o que excluir. */}
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
    </div>
  );
}
