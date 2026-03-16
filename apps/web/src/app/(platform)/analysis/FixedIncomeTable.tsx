"use client"
import { useFixedIncome } from "@/lib/hooks/useAnalysis"
import { Badge } from "@/components/shared/Badge"

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

const TYPE_COLOR: Record<string, "neutral"|"blue"|"green"|"purple"> = {
  "Tesouro SELIC": "blue", "Tesouro IPCA+": "blue", "Tesouro Prefixado": "blue",
  "CDB": "neutral", "LCI": "green", "LCA": "green",
}

export function FixedIncomeTable() {
  const { data = [] } = useFixedIncome()

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-200">Renda Fixa</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="py-2 px-3 text-neutral-400 font-medium text-left">Tipo</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-left">Emissor</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Taxa</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Vencimento</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-right">Mínimo</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-center">Rating</th>
              <th className="py-2 px-3 text-neutral-400 font-medium text-center">Liquidez</th>
            </tr>
          </thead>
          <tbody>
            {data.map(p => (
              <tr key={p.id} className="border-b border-neutral-800/40 hover:bg-neutral-800/40">
                <td className="py-2 px-3">
                  <Badge label={p.type} color={TYPE_COLOR[p.type] ?? "neutral"} />
                </td>
                <td className="py-2 px-3 text-neutral-300">{p.issuer}</td>
                <td className="py-2 px-3 text-right text-emerald-400 font-medium">{p.rate}</td>
                <td className="py-2 px-3 text-right text-neutral-300">{p.maturity}</td>
                <td className="py-2 px-3 text-right text-neutral-300">{brl(p.min_investment)}</td>
                <td className="py-2 px-3 text-center">
                  {p.rating ? <Badge label={p.rating} color="green" /> : "—"}
                </td>
                <td className="py-2 px-3 text-center">
                  <Badge
                    label={p.liquidity === "daily" ? "Diária" : "No vencimento"}
                    color={p.liquidity === "daily" ? "green" : "neutral"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
