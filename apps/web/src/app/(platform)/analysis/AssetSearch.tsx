"use client"
import { useState, useRef, useEffect } from "react"
import { Search } from "lucide-react"
import { useAssets } from "@/lib/hooks/useAnalysis"
import { Badge } from "@/components/shared/Badge"
import type { Asset } from "@/types"

const TYPE_COLOR: Record<string, "blue"|"purple"|"orange"|"green"> = {
  stock: "blue", reit: "purple", crypto: "orange", etf: "green",
}

interface Props { onSelect: (asset: Asset) => void; selected?: string }

export function AssetSearch({ onSelect, selected }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: results = [] } = useAssets(query)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative w-72">
      <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
        <Search size={14} className="text-neutral-500 shrink-0" />
        <input
          className="bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none w-full"
          placeholder="Buscar ativo (ex: PETR4, BTC)..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {selected && <span className="text-xs font-mono text-blue-400 shrink-0">{selected}</span>}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map(asset => (
            <button
              key={asset.ticker}
              onClick={() => { onSelect(asset); setQuery(""); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-800 transition-colors text-left"
            >
              <span className="font-mono text-xs font-bold text-neutral-100 w-16">{asset.ticker}</span>
              <span className="text-xs text-neutral-400 flex-1 truncate">{asset.name}</span>
              <Badge label={asset.type.toUpperCase()} color={TYPE_COLOR[asset.type] ?? "neutral"} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
