import { RebalanceTag } from "./RebalanceTag";
import type { PositionSummary } from "@/lib/portfolio-api";

interface PositionsTableProps {
  positions: PositionSummary[];
  isLoading: boolean;
  onAddTransaction: (positionId: string, ticker: string) => void;
}

function fmtBRL(v: number | string | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(v));
}

function fmtPct(v: number | string | null): string {
  if (v == null) return "0.00%";
  const num = Number(v);
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
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
          <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
        <div className="text-center">
          <p className="text-sm mb-1">Nenhuma posição neste portfólio</p>
          <p className="text-xs text-[var(--text-muted)]">Use "+ Ativo" para adicionar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {[
              "Ativo", "Qtd", "PM", "Atual", "Valor",
              "P&L R$", "P&L %", "Peso", "Alvo", "Rebalance", "Ações",
            ].map((h) => (
              <th
                key={h}
                className={`px-2 py-2 text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap ${
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
                className={`border-b border-neutral-900 transition-colors ${
                  pos.quantity === 0 ? "opacity-60 bg-black/10 dark:bg-white/5 hover:opacity-100" : "hover:bg-[var(--surface)]/50"
                }`}
              >
                <td className="px-2 py-1.5 text-left flex items-center gap-2">
                  <div>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-primary)]">
                      {pos.ticker}
                      {pos.quantity === 0 && (
                        <span className="px-1 py-0.5 rounded text-[8px] bg-blue-500/20 text-blue-400 font-normal tracking-wide">
                          MONITORANDO
                        </span>
                      )}
                    </span>
                    <span className="block text-[9px] text-[var(--text-muted)]">
                      {pos.asset_type}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--text-muted)]">
                  {Number(pos.quantity).toFixed(4)}
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--text-muted)]">
                  {fmtBRL(pos.avg_cost)}
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--text-muted)]">
                  {fmtBRL(pos.current_price)}
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--text-secondary)]">
                  {fmtBRL(pos.market_value_brl)}
                </td>
                <td className={`px-2 py-1.5 text-right ${pnlColor}`}>
                  {fmtBRL(pos.pnl_absolute)}
                </td>
                <td className={`px-2 py-1.5 text-right ${pnlColor}`}>
                  {fmtPct(pos.pnl_percent)}
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--text-muted)]">
                  {(Number(pos.weight) * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--text-muted)]">
                  {pos.target_weight != null
                    ? `${(Number(pos.target_weight) * 100).toFixed(1)}%`
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
                    className="text-[9px] text-[var(--accent)] border border-blue-900/30 bg-blue-950/20 px-2 py-0.5 rounded hover:bg-blue-950/50 transition-colors"
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
