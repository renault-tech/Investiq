"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { toast } from "sonner";
import { useFinanceSummary, useFinanceTransactions, useDeleteTransaction } from "@/hooks/useFinance";
import { NewFinanceTransactionModal } from "./NewTransactionModal";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmtBRL(v: string | number | null): string {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon: Icon }: {
  label: string; value: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
        <p className="text-[17px] font-bold text-[var(--text-primary)] leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function MiniBarChart({ bars }: { bars: { year: number; month: number; income: string; expense: string }[] }) {
  const maxVal = Math.max(...bars.flatMap((b) => [Number(b.income), Number(b.expense)]), 1);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-3">Últimos 6 meses</p>
      <div className="flex items-end gap-3 h-20">
        {bars.map((b) => {
          const incH = Math.max((Number(b.income) / maxVal) * 72, 2);
          const expH = Math.max((Number(b.expense) / maxVal) * 72, 2);
          return (
            <div key={`${b.year}-${b.month}`} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="flex items-end gap-0.5 h-[72px]">
                <div
                  className="w-3 rounded-t bg-[var(--accent)] opacity-80"
                  style={{ height: incH }}
                  title={`Receita: ${fmtBRL(b.income)}`}
                />
                <div
                  className="w-3 rounded-t bg-red-400 opacity-80"
                  style={{ height: expH }}
                  title={`Despesa: ${fmtBRL(b.expense)}`}
                />
              </div>
              <span className="text-[8px] text-[var(--text-muted)]">{MONTHS[b.month - 1]}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2">
        <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" /> Receita
        </span>
        <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-red-400" /> Despesa
        </span>
      </div>
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxRow({ tx, onDelete }: {
  tx: { id: string; transaction_type: string; amount: string; description: string; transaction_date: string; category_name: string | null; category_color: string | null };
  onDelete: (id: string) => void;
}) {
  const isIncome = tx.transaction_type === "income";
  const date = new Date(tx.transaction_date);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0 group">
      {/* Color dot */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: tx.category_color ?? (isIncome ? "#10B981" : "#EF4444") }}
      />
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{tx.description}</p>
        <p className="text-[10px] text-[var(--text-muted)]">
          {tx.category_name ?? "Sem categoria"} · {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </p>
      </div>
      {/* Amount */}
      <span className={`text-[13px] font-semibold shrink-0 ${isIncome ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
        {isIncome ? "+" : "-"}{fmtBRL(tx.amount)}
      </span>
      {/* Delete */}
      <button
        onClick={() => onDelete(tx.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-muted)] hover:text-red-500 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FinancesClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showModal, setShowModal] = useState(false);

  const { data: summary, isLoading: loadingSummary } = useFinanceSummary(year, month);
  const { data: transactions = [], isLoading: loadingTx } = useFinanceTransactions(year, month);
  const deleteMut = useDeleteTransaction(year, month);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Excluir esta transação?")) return;
    deleteMut.mutate(id, {
      onSuccess: () => toast.success("Transação removida."),
      onError: () => toast.error("Erro ao remover transação."),
    });
  };

  const incomeList = transactions.filter((t) => t.transaction_type === "income");
  const expenseList = transactions.filter((t) => t.transaction_type === "expense");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Finanças</h1>
        <div className="flex items-center gap-4">
          {/* Month nav */}
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-medium text-[var(--text-primary)] w-24 text-center">
              {MONTHS[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-[var(--navy)] text-white rounded-lg hover:opacity-80 transition-opacity"
          >
            <Plus size={14} /> Nova transação
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Receitas"
            value={loadingSummary ? "..." : fmtBRL(summary?.current.total_income ?? 0)}
            color="bg-[var(--accent)]"
            icon={TrendingUp}
          />
          <KpiCard
            label="Despesas"
            value={loadingSummary ? "..." : fmtBRL(summary?.current.total_expense ?? 0)}
            color="bg-red-500"
            icon={TrendingDown}
          />
          <KpiCard
            label="Saldo"
            value={loadingSummary ? "..." : fmtBRL(summary?.current.balance ?? 0)}
            color={Number(summary?.current.balance ?? 0) >= 0 ? "bg-[var(--navy)]" : "bg-[var(--danger)]"}
            icon={Scale}
          />
        </div>

        {/* Chart + Lists */}
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-4">
          {/* Bar chart */}
          {summary && <MiniBarChart bars={summary.last_6_months} />}

          {/* Receitas */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-3">
              Receitas · {incomeList.length}
            </p>
            {loadingTx ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}</div>
            ) : incomeList.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)]">Nenhuma receita neste mês.</p>
            ) : (
              incomeList.map((tx) => <TxRow key={tx.id} tx={tx} onDelete={handleDelete} />)
            )}
          </div>

          {/* Despesas */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-3">
              Despesas · {expenseList.length}
            </p>
            {loadingTx ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}</div>
            ) : expenseList.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)]">Nenhuma despesa neste mês.</p>
            ) : (
              expenseList.map((tx) => <TxRow key={tx.id} tx={tx} onDelete={handleDelete} />)
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <NewFinanceTransactionModal
          year={year}
          month={month}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
