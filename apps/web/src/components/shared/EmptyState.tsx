"use client"
import type { ReactNode } from "react"

interface Props { message: string; icon?: ReactNode }

export function EmptyState({ message, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-neutral-500">
      {icon && <div className="text-4xl">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  )
}
