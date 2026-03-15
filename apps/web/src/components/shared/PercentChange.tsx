"use client"

interface Props { value: number; label?: string }

export function PercentChange({ value, label }: Props) {
  const pos = value >= 0
  return (
    <span className={`text-xs font-medium ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? "+" : ""}{value.toFixed(2)}%
      {label && <span className="text-neutral-500 ml-1">{label}</span>}
    </span>
  )
}
