"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Download, FileText, Plus, Tags } from "lucide-react";
import { useCategories, useFinanceSummary, useTransactions, useDeleteTransaction } from "@/hooks/useFinance";
import { FinanceTransaction } from "@/lib/finance-api";
import { apiClient } from "@/lib/api-client";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { SummaryCards } from "./SummaryCards";
import { TransactionsTable } from "./TransactionsTable";
import { TransactionModal } from "./TransactionModal";
import { CategoryManager } from "./CategoryManager";
import { AccountsBar } from "./AccountsBar";
import { BudgetsSection } from "./BudgetsSection";
import { GoalsSection } from "./GoalsSection";

const ExpensesByCategoryDonut = dynamic(
  () => import("./FinanceCharts").then((m) => m.ExpensesByCategoryDonut),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const MonthlyFlowChart = dynamic(
  () => import("./FinanceCharts").then((m) => m.MonthlyFlowChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

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
  // "" = todos os titulares. Escopa a tabela de transações junto com as contas.
  const [holder, setHolder] = useState("");

  const { data: categories = [] } = useCategories();
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useFinanceSummary(month);

  const bounds = useMemo(() => monthBounds(month), [month]);
  const { data: txnList, isLoading: txnLoading, isError: txnError, refetch: refetchTxns } = useTransactions({
    date_from: bounds.from,
    date_to: bounds.to,
    transaction_type: typeFilter || undefined,
    category_id: categoryFilter || undefined,
    search: search || undefined,
    holder: holder || undefined,
    per_page: 200,
  });
  const deleteMutation = useDeleteTransaction();

  const shiftMonth = (delta: number) => {
    const [year, mon] = month.split("-").map(Number);
    setMonth(monthKey(new Date(year, mon - 1 + delta, 1)));
  };

  const handleDelete = (txn: FinanceTransaction) => {
    const isSeries = (txn.installment_total ?? 0) > 1;
    if (isSeries) {
      // Parcelamento tem três desfechos possíveis; confirm() só tem dois
      // botões, então a pergunta é encadeada em vez de adivinhar a intenção.
      const all = window.confirm(
        `"${txn.description ?? "Transação"}" é a parcela ${txn.installment_no}/${txn.installment_total}.\n\n` +
          "OK apaga a série inteira. Cancelar deixa você escolher apagar só esta parcela."
      );
      if (all) {
        deleteMutation.mutate({ id: txn.id, scope: "all" });
        return;
      }
      if (window.confirm("Apagar somente esta parcela?")) {
        deleteMutation.mutate({ id: txn.id, scope: "one" });
      }
      return;
    }
    if (
      window.confirm(
        `Excluir "${txn.description ?? "transação"}"?${txn.is_recurring ? " A série recorrente inteira será encerrada." : ""}`
      )
    ) {
      deleteMutation.mutate({ id: txn.id });
    }
  };

  const handleExport = async (format: "csv" | "ofx") => {
    const res = await apiClient.get(`/finance/transactions/export${format === "ofx" ? ".ofx" : ""}`, {
      params: { date_from: bounds.from, date_to: bounds.to },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transacoes-${month}.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadReport = async () => {
    const res = await apiClient.get("/reports/monthly", {
      params: { month },
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-${month}.pdf`;
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
            onClick={handleDownloadReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FileText size={15} /> Relatório PDF
          </button>
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

      <AccountsBar holder={holder} onHolderChange={setHolder} />

      {summaryError && !summaryLoading ? (
        <ErrorState title="Não foi possível carregar o resumo do mês." onRetry={refetchSummary} />
      ) : (
        <SummaryCards summary={summary} isLoading={summaryLoading} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Despesas por categoria"
          isLoading={summaryLoading}
          isError={summaryError}
          onRetry={refetchSummary}
          isEmpty={!summary || summary.by_category.length === 0}
          emptyMessage="Nenhuma despesa neste mês."
        >
          <ExpensesByCategoryDonut byCategory={summary?.by_category ?? []} />
        </ChartCard>
        <ChartCard
          title="Fluxo mensal (12 meses)"
          isLoading={summaryLoading}
          isError={summaryError}
          onRetry={refetchSummary}
          isEmpty={!summary || summary.monthly_series.every((p) => Number(p.income) === 0 && Number(p.expense) === 0)}
          emptyMessage="Sem movimentações nos últimos 12 meses."
        >
          <MonthlyFlowChart series={summary?.monthly_series ?? []} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BudgetsSection categories={categories} />
        <GoalsSection />
      </div>

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
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2"
          >
            <Download size={13} /> Exportar CSV
          </button>
          <button
            onClick={() => handleExport("ofx")}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2"
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
    </div>
  );
}
