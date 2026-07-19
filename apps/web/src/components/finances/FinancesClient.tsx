"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus, Tags } from "lucide-react";
import { useCategories, useFinanceSummary, useTransactions, useDeleteTransaction } from "@/hooks/useFinance";
import { FinanceTransaction } from "@/lib/finance-api";
import { apiClient } from "@/lib/api-client";
import { ChartCard } from "@/components/charts/ChartCard";
import { SummaryCards } from "./SummaryCards";
import { ExpensesByCategoryDonut, MonthlyFlowChart } from "./FinanceCharts";
import { TransactionsTable } from "./TransactionsTable";
import { TransactionModal } from "./TransactionModal";
import { CategoryManager } from "./CategoryManager";
import { BudgetsSection } from "./BudgetsSection";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
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
  const [editingTxn, setEditingTxn] = useState<FinanceTransaction | undefined>(undefined);

  const { data: categories = [] } = useCategories();
  const { data: summary, isLoading: summaryLoading } = useFinanceSummary(month);

  const bounds = useMemo(() => monthBounds(month), [month]);
  const { data: txnList, isLoading: txnLoading } = useTransactions({
    date_from: bounds.from,
    date_to: bounds.to,
    transaction_type: typeFilter || undefined,
    category_id: categoryFilter || undefined,
    search: search || undefined,
    per_page: 200,
  });
  const deleteMutation = useDeleteTransaction();

  const shiftMonth = (delta: number) => {
    const [year, mon] = month.split("-").map(Number);
    setMonth(monthKey(new Date(year, mon - 1 + delta, 1)));
  };

  const handleDelete = (txn: FinanceTransaction) => {
    if (window.confirm(`Excluir "${txn.description ?? "transação"}"?${txn.is_recurring ? " A série recorrente inteira será encerrada." : ""}`)) {
      deleteMutation.mutate(txn.id);
    }
  };

  const handleExport = async () => {
    const res = await apiClient.get("/finance/transactions/export", {
      params: { date_from: bounds.from, date_to: bounds.to },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transacoes-${month}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Finanças</h1>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => shiftMonth(-1)} aria-label="Mês anterior" className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-[var(--text-secondary)] capitalize min-w-36 text-center">
              {monthLabel(month)}
            </span>
            <button onClick={() => shiftMonth(1)} aria-label="Próximo mês" className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Tags size={15} /> Categorias
          </button>
          <button
            onClick={() => { setEditingTxn(undefined); setShowTransactionModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--navy)] text-white rounded-lg hover:opacity-90"
          >
            <Plus size={15} /> Nova transação
          </button>
        </div>
      </div>

      <SummaryCards summary={summary} isLoading={summaryLoading} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Despesas por categoria"
          isLoading={summaryLoading}
          isEmpty={!summary || summary.by_category.length === 0}
          emptyMessage="Nenhuma despesa neste mês."
        >
          <ExpensesByCategoryDonut byCategory={summary?.by_category ?? []} />
        </ChartCard>
        <ChartCard
          title="Fluxo mensal (12 meses)"
          isLoading={summaryLoading}
          isEmpty={!summary || summary.monthly_series.every((p) => Number(p.income) === 0 && Number(p.expense) === 0)}
          emptyMessage="Sem movimentações nos últimos 12 meses."
        >
          <MonthlyFlowChart series={summary?.monthly_series ?? []} />
        </ChartCard>
      </div>

      <BudgetsSection categories={categories} />

      {/* Filtros + tabela */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
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
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2"
          >
            <Download size={13} /> Exportar CSV
          </button>
        </div>

        <TransactionsTable
          transactions={txnList?.items ?? []}
          isLoading={txnLoading}
          onEdit={(txn) => { setEditingTxn(txn); setShowTransactionModal(true); }}
          onDelete={handleDelete}
        />
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
    </div>
  );
}
