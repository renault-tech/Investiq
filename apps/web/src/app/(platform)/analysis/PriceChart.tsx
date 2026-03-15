"use client"
import { useState, useEffect } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { useOHLCV } from "@/lib/hooks/useAnalysis"

const RANGES: Record<string, number> = { "1D": 1, "1W": 7, "1M": 30, "1A": 90 }

interface Props { ticker: string }

export function PriceChart({ ticker }: Props) {
  const [range, setRange] = useState("1M")
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data: ohlcv = [] } = useOHLCV(ticker, range)
  const sliced = ohlcv.slice(-RANGES[range])
  const last   = sliced[sliced.length - 1]
  const first  = sliced[0]
  const change = last && first ? ((last.close - first.close) / first.close) * 100 : 0
  const positive = change >= 0

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-3 flex-1">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-neutral-100">{ticker}</span>
          {last && (
            <span className="ml-3 text-lg font-semibold tabular-nums text-neutral-100">
              R$ {last.close.toFixed(2)}
            </span>
          )}
          {last && (
            <span className={`ml-2 text-xs font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
              {positive ? "+" : ""}{change.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {Object.keys(RANGES).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${range === r ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      {mounted ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={sliced}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={positive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={positive ? "#10b981" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false}
              tickFormatter={d => d.split("-").slice(1).join("/")} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false} width={55}
              domain={["auto","auto"]} tickFormatter={v => `${v.toFixed(0)}`} />
            <Tooltip
              contentStyle={{ background: "#171717", border: "1px solid #404040", borderRadius: "6px", fontSize: "11px" }}
              formatter={(v: number) => [v.toFixed(2), "Fechamento"]}
            />
            <Area type="monotone" dataKey="close" stroke={positive ? "#10b981" : "#ef4444"}
              strokeWidth={1.5} fill="url(#priceGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <div className="h-[240px] bg-neutral-800/50 animate-pulse rounded" />}
    </div>
  )
}
