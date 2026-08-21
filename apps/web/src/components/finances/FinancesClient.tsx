"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Layers, Plus, Tags } from "lucide-react";
import { useCategories, useFinanceSummary, useTransactions, useDeleteTransaction, usePayTransaction } from "@/hooks/useFinance";
import { useForecast } from "@/hooks/useForecast";
import { useAccounts } from "@/hooks/useAccounts";
import { FinanceTransaction } from "@/lib/finance-api";
import { apiClient } from "@/lib/api-client";
import { useFinanceScopeStore } from "@/store/useFinanceScopeStore";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SummaryCards } from "./SummaryCards";
import { CategoryBars } from "./CategoryBars";
import { TransactionsTable } from "./TransactionsTable";
import { TransactionModal } from "./TransactionModal";
import { DeleteTransactionModal, type DeleteScope } from "./DeleteTransactionModal";
import { CategoryManager } from "./CategoryManager";
import { AccountsBar } from "./AccountsBar";
import { BudgetsSection } from "./BudgetsSection";
import { ExportReportModal } from "@/components/reports/ExportReportModal";
import { ForecastChart } from "./ForecastChart";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  // "agosto de 2026" — a classe `capitalize` do CSS maiuscularia cada
  // palavra ("Agosto De 2026"); em português só a inicial é maiúscula.
  const label = new Date(year, mon - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, mon - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, mon, 0, 23, 59, 59)).toISOString();
  return { from, to };
}

export function FinancesClient() {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [typeFilter, setTypeFilter] = useState<"" | "income" | "expense">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editingTxn, setEditingTxn] = useState<FinanceTransaction | undefined>(undefined);
  const [deletingTxn, setDeletingTxn] = useState<FinanceTransaction | undefined>(undefined);
  // "" = todos os titulares. Escopa a tabela de transações junto com as contas.
  const [holder, setHolder] = useState("");
  // Carteira ativa (clicada em AccountsBar) — escopa a página inteira, não só a tabela.
  const activeAccountId = useFinanceScopeStore((s) => s.activeAccountId);
  const setActiveAccountId = useFinanceScopeStore((s) => s.setActiveAccountId);
  const { data: accounts = [] } = useAccounts();
  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  const { data: categories = [] } = useCategories();
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useFinanceSummary(month, activeAccountId, holder || undefined);
  const { data: forecast, isLoading: forecastLoading, isError: forecastError } = useForecast(6, activeAccountId, holder || undefined);

  const bounds = useMemo(() => monthBounds(month), [month]);
  const { data: txnList, isLoading: txnLoading, isError: txnError, refetch: refetchTxns } = useTransactions({
    date_from: bounds.from,
    date_to: bounds.to,
    transaction_type: typeFilter || undefined,
    category_id: categoryFilter || undefined,
    search: search || undefined,
    account_id: activeAccountId || undefined,
    holder: holder || undefined,
    per_page: 200,
  });
  const deleteMutation = useDeleteTransaction();
  const payMutation = usePayTransaction();

  const shiftMonth = (delta: number) => {
    const [year, mon] = month.split("-").map(Number);
    setMonth(monthKey(new Date(year, mon - 1 + delta, 1)));
  };

  const handleDelete = (txn: FinanceTransaction) => setDeletingTxn(txn);

  const confirmDelete = (scope: DeleteScope) => {
    if (!deletingTxn) return;
    deleteMutation.mutate(
      { id: deletingTxn.id, scope },
      { onSuccess: () => setDeletingTxn(undefined) }
    );
  };

  const handleExport = async (format: "csv" | "ofx") => {
    const res = await apiClient.get(`/finance/transactions/export${format === "ofx" ? ".ofx" : ""}`, {
      params: {
        date_from: bounds.from, date_to: bounds.to,
        account_id: activeAccountId || undefined, holder: holder || undefined,
      },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transacoes-${month}.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-[26px_30px_60px] flex flex-col gap-[18px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Finanças</h2>
          {activeAccount && (
            <button
              onClick={() => setActiveAccountId(null)}
              title="Clique para ver o consolidado"
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-colors"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--glow)" }}
            >
              <Layers size={12} /> {activeAccount.name}
            </button>
          )}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => shiftMonth(-1)} aria-label="Mês anterior" className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-[var(--text-secondary)] min-w-36 text-center">
              {monthLabel(month)}
            </span>
            <button onClick={() => shiftMonth(1)} aria-label="Próximo mês" className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3.5 h-[34px] text-[12.5px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] rounded-[11px] hover:text-[var(--text-primary)] transition-colors"
          >
            <FileText size={15} /> Exportar relatório
          </button>
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-1.5 px-3.5 h-[34px] text-[12.5px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] rounded-[11px] hover:text-[var(--text-primary)] transition-colors"
          >
            <Tags size={15} /> Categorias
          </button>
          <button
            data-tour="new-transaction"
            onClick={() => { setEditingTxn(undefined); setShowTransactionModal(true); }}
            className="flex items-center gap-1.5 px-3.5 h-[34px] text-[12.5px] font-medium rounded-[11px] transition-colors"
            style={{ background: "var(--accent)", color: "#04120D" }}
          >
            <Plus size={15} /> Nova transação
          </button>
        </div>
      </div>

      {summaryError && !summaryLoading ? (
        <ErrorState title="Não foi possível carregar o resumo do mês." onRetry={refetchSummary} />
      ) : (
        <SummaryCards summary={summary} isLoading={summaryLoading} />
      )}

      <div className="responsive-grid-12 grid gap-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
        <section className="col-span-8 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".1s" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Projeção de saldo</div>
              <div className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">Realizado e previsto pelos próximos meses</div>
            </div>
          </div>
          <div className="h-[210px] mt-4">
            {forecastError ? (
              <ErrorState title="Não foi possível carregar a projeção." />
            ) : forecastLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ForecastChart months={forecast?.months ?? []} negativeFrom={forecast?.negative_from ?? null} />
            )}
          </div>
        </section>

        <section className="col-span-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".16s" }}>
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">Gastos por categoria</div>
          {summaryLoading ? <Skeleton className="h-48" /> : <CategoryBars byCategory={summary?.by_category ?? []} />}
        </section>
      </div>

      <div data-tour="accounts-bar">
        <AccountsBar holder={holder} onHolderChange={setHolder} />
      </div>

      <div data-tour="budgets-section">
        <BudgetsSection categories={categories} />
      </div>

      {/* Filtros + tabela */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-2 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-secondary)]"
            aria-label="Filtrar por tipo"
          >
            <option value="">Todos os tipos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-secondary)]"
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas as categorias</option>
            {categories.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar descrição…"
            className="flex-1 min-w-40 px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)]"
            aria-label="Buscar por descrição"
          />
          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5"
          >
            <Download size={13} /> Exportar CSV
          </button>
          <button
            onClick={() => handleExport("ofx")}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5"
          >
            <Download size={13} /> Exportar OFX
          </button>
        </div>

        {txnError && !txnLoading ? (
          <ErrorState title="Não foi possível carregar as transações." onRetry={refetchTxns} />
        ) : (
          <TransactionsTable
            transactions={txnList?.items ?? []}
            isLoading={txnLoading}
            onEdit={(txn) => { setEditingTxn(txn); setShowTransactionModal(true); }}
            onDelete={handleDelete}
            onPay={(txn) => payMutation.mutate(txn.id)}
          />
        )}
      </div>

      {showTransactionModal && (
        <TransactionModal
          categories={categories}
          editing={editingTxn}
          onClose={() => { setShowTransactionModal(false); setEditingTxn(undefined); }}
        />
      )}
      {showCategoryManager && (
        <CategoryManager categories={categories} onClose={() => setShowCategoryManager(false)} />
      )}
      {showExport && (
        <ExportReportModal month={month} origin="finances" onClose={() => setShowExport(false)} />
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
  );
}
