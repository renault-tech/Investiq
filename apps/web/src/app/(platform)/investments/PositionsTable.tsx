"use client"
import { usePositions } from "@/lib/hooks/usePortfolio"
import { DataTable, Column } from "@/components/shared/DataTable"
import { PercentChange } from "@/components/shared/PercentChange"
import { Badge } from "@/components/shared/Badge"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import type { Position } from "@/types"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const fmt = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })

const TYPE_COLOR: Record<string, "blue" | "purple" | "orange" | "green" | "neutral"> = {
  stock: "blue", reit: "purple", crypto: "orange", etf: "green", bond: "neutral",
}

const COLUMNS: Column<Position>[] = [
  { key: "ticker",           header: "Ticker",    render: r => <span className="font-mono font-bold text-neutral-100">{r.ticker}</span> },
  { key: "name",             header: "Nome" },
  { key: "asset_type",       header: "Tipo",      render: r => <Badge label={r.asset_type.toUpperCase()} color={TYPE_COLOR[r.asset_type]} /> },
  { key: "quantity",         header: "Qtd",       align: "right", render: r => fmt(r.quantity, r.asset_type === "crypto" ? 4 : 0) },
  { key: "avg_cost",         header: "P. Médio",  align: "right", render: r => brl(r.avg_cost) },
  { key: "current_price",    header: "P. Atual",  align: "right", render: r => brl(r.current_price) },
  { key: "current_value",    header: "Valor",     align: "right", render: r => brl(r.current_value) },
  { key: "pnl",              header: "P&L",       align: "right", render: r => <span className={r.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>{brl(r.pnl)}</span> },
  { key: "pnl_pct",          header: "P&L %",     align: "right", render: r => <PercentChange value={r.pnl_pct} /> },
  { key: "portfolio_weight", header: "% Cart.",   align: "right", render: r => `${r.portfolio_weight.toFixed(1)}%` },
]

export function PositionsTable() {
  const { data = [], isLoading } = usePositions()

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Posições</h2>
        <span className="text-xs text-neutral-500">{data.length} ativos</span>
      </div>
      {isLoading ? <LoadingSkeleton variant="table" /> : <DataTable<Position> columns={COLUMNS} data={data} keyField="id" />}
    </div>
  )
}
