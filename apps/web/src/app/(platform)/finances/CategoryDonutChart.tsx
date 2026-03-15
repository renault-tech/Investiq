"use client"
import { useEffect, useState } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { useFinanceDashboard } from "@/lib/hooks/useFinance"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

export function CategoryDonutChart() {
  const { data } = useFinanceDashboard()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const chartData = data?.by_category.filter(c => c.amount > 0) ?? []

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-200">Despesas por Categoria</h2>
      {mounted ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={chartData} dataKey="amount" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip
              formatter={(v: number) => [brl(v), ""]}
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: "6px", fontSize: "11px" }}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] bg-neutral-800/50 animate-pulse rounded" />
      )}
    </div>
  )
}
