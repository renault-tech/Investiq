"use client"
import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { usePositions } from "@/lib/hooks/usePortfolio"
import type { Position } from "@/types"

const PALETTE = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#f97316","#06b6d4","#ec4899","#14b8a6","#84cc16"]

type GroupBy = "asset" | "type"

function group(positions: Position[], by: GroupBy) {
  const map = new Map<string, number>()
  for (const p of positions) {
    const key = by === "asset" ? p.ticker : p.asset_type
    map.set(key, (map.get(key) ?? 0) + p.portfolio_weight)
  }
  return Array.from(map.entries()).map(([name, value], i) => ({
    name, value: +value.toFixed(1), fill: PALETTE[i % PALETTE.length],
  }))
}

export function AllocationChart() {
  const { data: positions = [] } = usePositions()
  const [groupBy, setGroupBy] = useState<GroupBy>("asset")
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const chartData = group(positions, groupBy)

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Alocação</h2>
        <div className="flex gap-1">
          {(["asset","type"] as GroupBy[]).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${groupBy === g ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>
              {g === "asset" ? "Ativo" : "Tipo"}
            </button>
          ))}
        </div>
      </div>
      {mounted ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
              {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Pie>
            <Tooltip
              formatter={(v) => [`${v}%`, ""]}
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
