"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Layers, Plus, Tags } from "lucide-react";
import { useCategories, useFinanceSummary, useTransactions, useDeleteTransaction, usePayTransaction, useUnpayTransaction } from "@/hooks/useFinance";
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
import { MonthStepper, monthKey } from "./MonthStepper";
import { PlannedVsActual } from "./PlannedVsActual";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { useDashboardLayout, type DashboardCardSpec } from "@/hooks/useDashboardLayout";
import { useUIStore } from "@/store/useUIStore";
import { TransactionModal } from "./TransactionModal";
import { DeleteTransactionModal, type DeleteScope } from "./DeleteTransactionModal";
import { CategoryManager } from "./CategoryManager";
import { AccountsBar } from "./AccountsBar";
import { BudgetsSection } from "./BudgetsSection";
import { ExportReportModal } from "@/components/reports/ExportReportModal";
import { ForecastChart } from "./ForecastChart";

const FINANCE_CARDS: DashboardCardSpec[] = [
  { id: "forecast", label: "Projeção de saldo", defaultSpan: 8, minSpan: 6 },
  { id: "categories", label: "Gastos por categoria", defaultSpan: 4, minSpan: 3 },
  { id: "planned", label: "Previsto × executado", defaultSpan: 6, minSpan: 4 },
  // Preenche o resto da linha ao lado de "Previsto × executado" por padrão —
  // antes ficava fora da grade, numa seção fixa mais abaixo, desalinhada dos
  // demais cards e sem poder ser movida ou redimensionada como eles.
  { id: "accounts", label: "Contas", defaultSpan: 6, minSpan: 4 },
];

function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, mon - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, mon, 0, 23, 59, 59)).toISOString();
  return { from, to };
}

export function FinancesClient() {
  const [month, setMonth] = useState(() => monthKey(new Date()));

  // Mesmos cards ajustáveis da Visão Geral: quem organiza o painel lá espera
  // poder organizar aqui também.
  const customize = useUIStore((st) => st.customize);
  const layout = useDashboardLayout("finances", FINANCE_CARDS);
  const visible = (id: string) => !layout.isHidden(id);
  const cardProps = (id: string, delay: number) => ({
    id,
    label: layout.specById[id]?.label ?? id,
    customize,
    span: layout.spanOf(id),
    minSpan: layout.specById[id]?.minSpan,
    dragged: layout.dragged,
    onDragStart: layout.handleDragStart,
    onDrop: layout.handleDrop,
    onHide: layout.hide,
    onSpanChange: layout.setSpan,
    order: layout.order.indexOf(id),
    delay,
  });
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
  const unpayMutation = useUnpayTransaction();

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
          <div className="ml-2">
            <MonthStepper month={month} onShift={shiftMonth} />
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

      {customize && (
        <div className="flex items-center gap-3 flex-wrap px-4 py-3 border border-dashed border-[var(--accent)] rounded-2xl bg-[var(--glow)] animate-rise-up">
          <span className="text-[12.5px] font-medium text-[var(--text-primary)]">
            Modo edição — arraste para reposicionar, use ¼ ½ ⅔ 1 para redimensionar e × para ocultar.
          </span>
          {layout.hiddenCards.map((card) => (
            <button
              key={card.id}
              onClick={() => layout.restore(card.id)}
              className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text-secondary)]"
            >
              + {card.label}
            </button>
          ))}
          <button
            onClick={layout.reset}
            className="ml-auto text-[11.5px] px-2.5 py-1.5 rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)]"
          >
            Restaurar padrão
          </button>
        </div>
      )}

      <div className="responsive-grid-12 grid gap-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
        {visible("forecast") && (
        <DashboardCard {...cardProps("forecast", 0.1)}>
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
        </DashboardCard>
        )}

        {visible("categories") && (
        <DashboardCard {...cardProps("categories", 0.16)}>
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">Gastos por categoria</div>
          {summaryLoading ? <Skeleton className="h-48" /> : <CategoryBars byCategory={summary?.by_category ?? []} />}
        </DashboardCard>
        )}

        {visible("planned") && (
        <DashboardCard {...cardProps("planned", 0.2)}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Previsto × executado</div>
            <MonthStepper month={month} onShift={shiftMonth} compact ariaContext="previsto" />
          </div>
          <PlannedVsActual transactions={txnList?.items ?? []} isLoading={txnLoading} />
        </DashboardCard>
        )}

        {visible("accounts") && (
        <DashboardCard {...cardProps("accounts", 0.24)} data-tour="accounts-bar">
          <AccountsBar holder={holder} onHolderChange={setHolder} bare />
        </DashboardCard>
        )}
      </div>

      <div data-tour="budgets-section">
        <BudgetsSection categories={categories} />
      </div>

      {/* Filtros + tabela */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Mesmo seletor do topo: a lista fica longe do cabeçalho, e trocar
              o mês do que se está lendo não deveria exigir voltar lá em cima. */}
          <MonthStepper month={month} onShift={shiftMonth} compact />
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
            onUnpay={(txn) => unpayMutation.mutate(txn.id)}
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
