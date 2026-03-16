"use client"
import { useState } from "react"
import { AssetSearch }      from "./AssetSearch"
import { PriceChart }       from "./PriceChart"
import { IndicatorsPanel }  from "./IndicatorsPanel"
import { AIAnalysisPanel }  from "./AIAnalysisPanel"
import { FixedIncomeTable } from "./FixedIncomeTable"
import type { Asset } from "@/types"

const DEFAULT: Asset = { ticker: "PETR4", name: "Petrobras PN", type: "stock", exchange: "BOVESPA" }

export default function AnalysisPage() {
  const [asset, setAsset] = useState<Asset>(DEFAULT)

  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AssetSearch onSelect={setAsset} selected={asset.ticker} />
        <span className="text-xs text-neutral-500">{asset.name} · {asset.exchange}</span>
      </div>
      <div className="flex gap-4 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <PriceChart ticker={asset.ticker} />
          <FixedIncomeTable />
        </div>
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <IndicatorsPanel ticker={asset.ticker} />
          <AIAnalysisPanel ticker={asset.ticker} />
        </div>
      </div>
    </div>
  )
}
