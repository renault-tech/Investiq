"use client"
import { useFinanceDashboard } from "@/lib/hooks/useFinance"
import { StatCard } from "@/components/shared/StatCard"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

export function FinanceSummaryCards() {
  const { data, isLoading } = useFinanceDashboard()

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <LoadingSkeleton key={i} variant="card" />)}
    </div>
  )
  if (!data) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Receita Mês"    value={brl(data.monthly_income)}   valueColor="text-emerald-400" />
      <StatCard label="Despesas Mês"   value={brl(data.monthly_expenses)} valueColor="text-red-400" />
      <StatCard label="Saldo Líquido"  value={brl(data.net)}              valueColor={data.net >= 0 ? "text-emerald-400" : "text-red-400"} />
      <StatCard label="Total Contas"   value={brl(data.accounts_total)} />
    </div>
  )
}
