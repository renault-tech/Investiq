"use client"
import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts"
import { useFinanceDashboard } from "@/lib/hooks/useFinance"

export function MonthlyBarChart() {
  const { data } = useFinanceDashboard()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-200">Receita vs Despesa (6 meses)</h2>
      {mounted ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data?.monthly_trend ?? []} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} width={50}
              tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: "6px", fontSize: "11px" }}
              formatter={(v) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v)), ""]}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
            <Bar dataKey="income"   name="Receita"  fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] bg-neutral-800/50 animate-pulse rounded" />
      )}
    </div>
  )
}
