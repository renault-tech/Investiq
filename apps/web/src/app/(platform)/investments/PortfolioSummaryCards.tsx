"use client"
import { usePortfolioSummary } from "@/lib/hooks/usePortfolio"
import { StatCard } from "@/components/shared/StatCard"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

export function PortfolioSummaryCards() {
  const { data, isLoading } = usePortfolioSummary()

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <LoadingSkeleton key={i} variant="card" />)}
    </div>
  )
  if (!data) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Patrimônio Total"  value={brl(data.total_value)} />
      <StatCard label="P&L Total"         value={brl(data.total_pnl)}   change={data.total_pnl_pct} />
      <StatCard label="Variação Hoje"     value={brl(data.day_change)}  change={data.day_change_pct} />
      <StatCard label="Posições"          value={String(data.positions_count)} />
    </div>
  )
}
