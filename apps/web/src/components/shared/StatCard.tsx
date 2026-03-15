"use client"
import type { ReactNode } from "react"
import { PercentChange } from "./PercentChange"

interface StatCardProps {
  label: string
  value: string
  change?: number
  changeLabel?: string
  icon?: ReactNode
  valueColor?: string
}

export function StatCard({ label, value, change, changeLabel, icon, valueColor }: StatCardProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-neutral-500 uppercase tracking-widest">{label}</span>
        {icon && <span className="text-neutral-600">{icon}</span>}
      </div>
      <span className={`text-xl font-semibold tabular-nums ${valueColor ?? "text-neutral-100"}`}>
        {value}
      </span>
      {change !== undefined && (
        <PercentChange value={change} label={changeLabel} />
      )}
    </div>
  )
}
