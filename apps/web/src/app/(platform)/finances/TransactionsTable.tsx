"use client"
import { useState } from "react"
import { useTransactions } from "@/lib/hooks/useFinance"
import { DataTable, Column } from "@/components/shared/DataTable"
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton"
import type { FinancialTransaction } from "@/types"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const COLUMNS: Column<FinancialTransaction>[] = [
  { key: "date",          header: "Data",       render: r => r.date.split("-").reverse().join("/") },
  { key: "description",   header: "Descrição" },
  { key: "category_name", header: "Categoria",  render: r => (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.category_color }} />
      {r.category_name}
    </span>
  )},
  { key: "account",       header: "Conta" },
  { key: "amount",        header: "Valor",      align: "right",
    render: r => (
      <span className={r.type === "income" ? "text-emerald-400" : "text-red-400"}>
        {r.type === "income" ? "+" : "-"}{brl(r.amount)}
      </span>
    )
  },
]

const MONTHS = [
  { label: "Março 2026",     value: "2026-03" },
  { label: "Fevereiro 2026", value: "2026-02" },
  { label: "Janeiro 2026",   value: "2026-01" },
]

export function TransactionsTable() {
  const [month, setMonth] = useState("2026-03")
  const { data = [], isLoading } = useTransactions({ month })

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-neutral-200">Transações</h2>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs rounded px-2 py-1"
        >
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      {isLoading
        ? <LoadingSkeleton variant="table" />
        : <DataTable<FinancialTransaction> columns={COLUMNS} data={data} keyField="id" emptyMessage="Nenhuma transação no período" />
      }
    </div>
  )
}
