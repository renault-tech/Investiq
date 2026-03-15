"use client"

interface Props { variant?: "card" | "table" | "chart" | "row" }

export function LoadingSkeleton({ variant = "card" }: Props) {
  if (variant === "card") {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col gap-2 animate-pulse">
        <div className="h-2 w-20 bg-neutral-800 rounded" />
        <div className="h-6 w-32 bg-neutral-800 rounded" />
        <div className="h-2 w-14 bg-neutral-800 rounded" />
      </div>
    )
  }
  if (variant === "table") {
    return (
      <div className="flex flex-col gap-2 animate-pulse p-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-neutral-800/60 rounded" />
        ))}
      </div>
    )
  }
  if (variant === "chart") {
    return <div className="bg-neutral-800/60 rounded animate-pulse" style={{ height: "200px" }} />
  }
  return <div className="h-8 bg-neutral-800/60 rounded animate-pulse" />
}
