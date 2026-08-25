"use client";

import { useMemo, useState } from "react";
import { Search, X, Pencil, ArrowLeftRight, Layers } from "lucide-react";
import { useCategories, useTransactions, useDeleteTransaction, usePayTransaction } from "@/hooks/useFinance";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinanceScopeStore } from "@/store/useFinanceScopeStore";
import { FinanceTransaction } from "@/lib/finance-api";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { useUIStore, maskValue } from "@/store/useUIStore";
import { TransactionsTable } from "@/components/finances/TransactionsTable";
import { TransactionModal } from "@/components/finances/TransactionModal";
import { DeleteTransactionModal, type DeleteScope } from "@/components/finances/DeleteTransactionModal";
import { AccountsBar } from "@/components/finances/AccountsBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

// Recorrências só se projetam para o futuro quando `date_to` é informado
// (ver expand_recurring em src/finance/service.py) — sem bound nenhum, todo
// o histórico real aparece, mas nenhuma ocorrência virtual futura entrava
// aqui, diferente de parcelamento (que já materializa as linhas reais).
// 6 meses casa com a janela padrão do Planejamento/Forecast.
function sixMonthsAhead(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString();
}

const SOURCE_LABELS: Record<FinanceTransaction["source"], string> = {
  manual: "Lançamento manual",
  import_ofx: "Importado (OFX)",
  import_csv: "Importado (CSV)",
  card_invoice: "Fatura de cartão",
  installment: "Parcelamento",
};

const TYPE_FILTERS: { value: "" | "income" | "expense" | "transfer"; label: string }[] = [
  { value: "", label: "Tudo" },
  { value: "expense", label: "Despesas" },
  { value: "income", label: "Receitas" },
  { value: "transfer", label: "Transferências" },
];

export function TransactionsClient() {
  const privacy = useUIStore((s) => s.privacy);
  const mask = (text: string) => maskValue(text, privacy);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "income" | "expense" | "transfer">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTxn, setEditingTxn] = useState<FinanceTransaction | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [deletingTxn, setDeletingTxn] = useState<FinanceTransaction | undefined>(undefined);
  // "" = todos os titulares — mesmo filtro da tela de Finanças.
  const [holder, setHolder] = useState("");
  const activeAccountId = useFinanceScopeStore((s) => s.activeAccountId);
  const setActiveAccountId = useFinanceScopeStore((s) => s.setActiveAccountId);
  const { data: accounts = [] } = useAccounts();
  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  const { data: categories = [] } = useCategories();
  // Fixo por montagem do componente — recalcular a cada render mudaria a
  // query key do React Query (date_to muda de milissegundo a milissegundo)
  // e disparava uma nova busca sem parar.
  const [dateTo] = useState(() => sixMonthsAhead());
  const { data: txPage, isLoading, isError, refetch } = useTransactions({
    search: search || undefined,
    transaction_type: typeFilter || undefined,
    account_id: activeAccountId || undefined,
    holder: holder || undefined,
    date_to: dateTo,
    per_page: 100,
  });
  const { data: analytics } = useAnalytics(6, activeAccountId, holder || undefined);
  const deleteMutation = useDeleteTransaction();
  const payMutation = usePayTransaction();

  const items = txPage?.items ?? [];
  const selected = items.find((t) => t.id === selectedId);

  const categoryHistory = useMemo(() => {
    if (!selected || !analytics) return null;
    return analytics.category_matrix.find((row) => row.category_id === selected.category_id) ?? null;
  }, [selected, analytics]);

  const handleDelete = (txn: FinanceTransaction) => setDeletingTxn(txn);

  const confirmDelete = (scope: DeleteScope) => {
    if (!deletingTxn) return;
    const txnId = deletingTxn.id;
    deleteMutation.mutate(
      { id: txnId, scope },
      {
        onSuccess: () => {
          setDeletingTxn(undefined);
          if (selectedId === txnId) setSelectedId(null);
        },
      }
    );
  };

  return (
    <div className="p-[26px_30px_60px] flex flex-col gap-[18px]">
      <AccountsBar holder={holder} onHolderChange={setHolder} />
      <div className="flex flex-col md:flex-row gap-[18px] items-start">
      <section className="flex-1 min-w-0 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-[22px] shadow-[var(--shadow)] animate-rise-up">
        <div className="flex items-center gap-2.5 flex-wrap mb-4">
          {activeAccount && (
            <button
              onClick={() => setActiveAccountId(null)}
              title="Clique para ver o consolidado"
              className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] rounded-lg border transition-colors"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--glow)" }}
            >
              <Layers size={12} /> {activeAccount.name}
            </button>
          )}
          <div className="flex-1 min-w-[200px] flex items-center gap-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3.5 py-2">
            <Search size={15} className="text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por estabelecimento, valor ou categoria"
              className="flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
          </div>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className="px-3.5 py-2 rounded-[11px] text-xs font-medium border transition-colors"
              style={{
                borderColor: typeFilter === f.value ? "var(--accent)" : "var(--border)",
                background: typeFilter === f.value ? "var(--glow)" : "transparent",
                color: typeFilter === f.value ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isError && !isLoading ? (
          <ErrorState title="Não foi possível carregar as transações." onRetry={refetch} />
        ) : !isLoading && items.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="Nenhuma transação encontrada." />
        ) : (
          <TransactionsTable
            transactions={items}
            isLoading={isLoading}
            onEdit={(txn) => { setEditingTxn(txn); setShowModal(true); }}
            onDelete={handleDelete}
            onPay={(txn) => payMutation.mutate(txn.id)}
            onRowClick={(txn) => setSelectedId(txn.id === selectedId ? null : txn.id)}
            selectedId={selectedId}
          />
        )}
      </section>

      {selected && (
        <aside className="w-full md:w-[340px] flex-shrink-0 md:sticky md:top-[92px] border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-slide-in">
          <div className="flex justify-between items-start">
            <div className="w-[46px] h-[46px] rounded-2xl bg-[var(--surface-3)] flex items-center justify-center text-[15px] font-semibold text-[var(--text-secondary)]">
              {(selected.description ?? selected.category_name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="w-7 h-7 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>
          </div>
          <div className="text-[17px] font-semibold mt-3.5 tracking-[-.02em] text-[var(--text-primary)]">
            {selected.description ?? selected.category_name ?? "Transação"}
          </div>
          <div
            className="text-3xl font-semibold tracking-[-.045em] mt-2 tabular-nums"
            style={{ color: selected.transaction_type === "income" ? "var(--accent)" : selected.transaction_type === "transfer" ? "var(--text-primary)" : "var(--danger)" }}
          >
            {mask(`${selected.transaction_type === "income" ? "+" : selected.transaction_type === "expense" ? "−" : ""}${formatBRLExact(Number(selected.amount))}`)}
          </div>
          <div className="text-[12.5px] text-[var(--text-secondary)] mt-1">
            {new Date(selected.transaction_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </div>

          <div className="mt-5 flex flex-col gap-3.5 text-[12.5px] border-t border-[var(--border)] pt-4.5">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Categoria</span>
              <b className="font-semibold text-[var(--text-primary)]">{selected.category_name ?? "—"}</b>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)] whitespace-nowrap">Conta</span>
              <b className="font-semibold text-right text-[var(--text-primary)]">
                {selected.transaction_type === "transfer" && selected.to_bank_account_name
                  ? `${selected.bank_account_name ?? "—"} → ${selected.to_bank_account_name}`
                  : selected.bank_account_name ?? "—"}
              </b>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)] whitespace-nowrap">Origem</span>
              <b className="font-semibold text-right text-[var(--text-primary)]">{SOURCE_LABELS[selected.source]}</b>
            </div>
            {selected.installment_total && selected.installment_total > 1 && (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Parcela</span>
                <b className="font-semibold text-[var(--text-primary)]">{selected.installment_no}/{selected.installment_total}</b>
              </div>
            )}
          </div>

          {categoryHistory && (
            <div className="mt-4.5 border-t border-[var(--border)] pt-4.5">
              <div className="text-xs text-[var(--text-secondary)] mb-2.5">Histórico em {selected.category_name} · {categoryHistory.values.length} meses</div>
              <div className="flex items-end gap-1.5 h-14">
                {(() => {
                  const max = Math.max(1, ...categoryHistory.values.map(Number));
                  return categoryHistory.values.map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded animate-grow-y"
                      style={{ height: `${(Number(v) / max) * 100}%`, background: i === categoryHistory.values.length - 1 ? "var(--accent)" : "var(--surface-3)" }}
                    />
                  ));
                })()}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button
              onClick={() => { setEditingTxn(selected); setShowModal(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
              style={{ background: "var(--accent)", color: "#04120D" }}
            >
              <Pencil size={13} /> Editar
            </button>
            <button
              onClick={() => handleDelete(selected)}
              className="px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--danger)]"
            >
              Excluir
            </button>
          </div>
        </aside>
      )}

      {showModal && (
        <TransactionModal
          categories={categories}
          editing={editingTxn}
          onClose={() => { setShowModal(false); setEditingTxn(undefined); }}
        />
      )}
      {deletingTxn && (
        <DeleteTransactionModal
          txn={deletingTxn}
          isPending={deleteMutation.isPending}
          onConfirm={confirmDelete}
          onClose={() => setDeletingTxn(undefined)}
        />
      )}
      </div>
    </div>
  );
}
