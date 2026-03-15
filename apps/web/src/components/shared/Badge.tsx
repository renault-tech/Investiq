"use client"

const COLORS: Record<string, string> = {
  blue:    "bg-blue-900/50 text-blue-300 border-blue-800",
  green:   "bg-emerald-900/50 text-emerald-300 border-emerald-800",
  red:     "bg-red-900/50 text-red-300 border-red-800",
  yellow:  "bg-yellow-900/50 text-yellow-300 border-yellow-800",
  purple:  "bg-purple-900/50 text-purple-300 border-purple-800",
  orange:  "bg-orange-900/50 text-orange-300 border-orange-800",
  cyan:    "bg-cyan-900/50 text-cyan-300 border-cyan-800",
  neutral: "bg-neutral-800 text-neutral-300 border-neutral-700",
}

interface BadgeProps { label: string; color?: keyof typeof COLORS }

export function Badge({ label, color = "neutral" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${COLORS[color] ?? COLORS.neutral}`}>
      {label}
    </span>
  )
}
