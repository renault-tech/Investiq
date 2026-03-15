"use client"
import { useRebalance } from "@/lib/hooks/usePortfolio"
import { PercentChange } from "@/components/shared/PercentChange"
import { Badge } from "@/components/shared/Badge"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const ACTION_COLOR = { buy: "green", sell: "red", hold: "neutral" } as const

export function RebalancePanel() {
  const { data = [] } = useRebalance()

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-200">Rebalanceamento</h2>
        <button
          onClick={() => alert("Funcionalidade em breve")}
          className="px-3 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Executar
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="py-2 px-3 text-neutral-400 font-medium text-left">Ativo</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Atual%</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Alvo%</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Dif.</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-center">Ação</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Sugestão</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.ticker} className="border-b border-neutral-800/40 hover:bg-neutral-800/40">
                <td className="py-2 px-3 font-mono font-semibold text-neutral-100">{r.ticker}</td>
                <td className="py-2 px-3 text-right text-neutral-300">{r.current_weight.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right text-neutral-300">{r.target_weight.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right"><PercentChange value={r.diff} /></td>
                <td className="py-2 px-3 text-center">
                  <Badge label={r.action.toUpperCase()} color={ACTION_COLOR[r.action]} />
                </td>
                <td className="py-2 px-3 text-right text-neutral-400 text-[10px]">
                  {r.action !== "hold"
                    ? `${r.action === "buy" ? "Comprar" : "Vender"} ${r.quantity} un. (${brl(r.value)})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
