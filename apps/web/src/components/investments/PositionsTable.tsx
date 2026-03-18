import { RebalanceTag } from "./RebalanceTag";
import type { PositionSummary } from "@/lib/portfolio-api";

interface PositionsTableProps {
  positions: PositionSummary[];
  isLoading: boolean;
  onAddTransaction: (positionId: string, ticker: string) => void;
}

function fmtBRL(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function PositionsTable({
  positions,
  isLoading,
  onAddTransaction,
}: PositionsTableProps) {
  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-neutral-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-500">
        <div className="text-center">
          <p className="text-sm mb-1">Nenhuma posição neste portfólio</p>
          <p className="text-xs text-neutral-600">Use "+ Ativo" para adicionar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="border-b border-neutral-800">
            {[
              "Ativo", "Qtd", "PM", "Atual", "Valor",
              "P&L R$", "P&L %", "Peso", "Alvo", "Rebalance", "Ações",
            ].map((h) => (
              <th
                key={h}
                className={`px-2 py-2 text-[9px] font-medium text-neutral-600 uppercase tracking-wider whitespace-nowrap ${
                  h === "Ativo" ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const pnlPositive = pos.pnl_absolute >= 0;
            const pnlColor = pnlPositive ? "text-green-500" : "text-red-500";
            return (
              <tr
                key={pos.position_id}
                className="border-b border-neutral-900 hover:bg-neutral-900/50 transition-colors"
              >
                <td className="px-2 py-1.5 text-left">
                  <span className="block text-[11px] font-semibold text-neutral-100">
                    {pos.ticker}
                  </span>
                  <span className="block text-[9px] text-neutral-600">
                    {pos.asset_type}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-400">
                  {pos.quantity.toFixed(4)}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-400">
                  {fmtBRL(pos.avg_cost)}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-400">
                  {fmtBRL(pos.current_price)}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-300">
                  {fmtBRL(pos.market_value_brl)}
                </td>
                <td className={`px-2 py-1.5 text-right ${pnlColor}`}>
                  {fmtBRL(pos.pnl_absolute)}
                </td>
                <td className={`px-2 py-1.5 text-right ${pnlColor}`}>
                  {fmtPct(pos.pnl_percent)}
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-400">
                  {(pos.weight * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1.5 text-right text-neutral-500">
                  {pos.target_weight !== null
                    ? `${(pos.target_weight * 100).toFixed(1)}%`
                    : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <RebalanceTag
                    action={pos.rebalance_action}
                    deltaUnits={pos.rebalance_delta_units}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={() => onAddTransaction(pos.position_id, pos.ticker)}
                    className="text-[9px] text-blue-400 border border-blue-900/30 bg-blue-950/20 px-2 py-0.5 rounded hover:bg-blue-950/50 transition-colors"
                  >
                    Transação
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
