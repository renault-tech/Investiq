"use client"
import { useIndicators } from "@/lib/hooks/useAnalysis"
import { Badge } from "@/components/shared/Badge"

const SIGNAL_COLOR = { BUY: "green", SELL: "red", NEUTRAL: "neutral" } as const

interface Props { ticker: string }

export function IndicatorsPanel({ ticker }: Props) {
  const { data = [] } = useIndicators(ticker)

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-200">Indicadores Técnicos</h2>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-800">
            <th className="py-2 px-3 text-neutral-400 font-medium text-left">Indicador</th>
            <th className="py-2 px-3 text-neutral-400 font-medium text-right">Valor</th>
            <th className="py-2 px-3 text-neutral-400 font-medium text-center">Sinal</th>
          </tr>
        </thead>
        <tbody>
          {data.map(ind => (
            <tr key={ind.name} className="border-b border-neutral-800/40 hover:bg-neutral-800/40">
              <td className="py-2 px-3 text-neutral-300">{ind.name}</td>
              <td className="py-2 px-3 text-right font-mono text-neutral-200">{ind.value}</td>
              <td className="py-2 px-3 text-center">
                <Badge label={ind.signal} color={SIGNAL_COLOR[ind.signal]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
