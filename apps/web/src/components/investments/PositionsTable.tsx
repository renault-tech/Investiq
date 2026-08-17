import Link from "next/link";
import { Settings2, Wallet } from "lucide-react";
import { RebalanceTag } from "./RebalanceTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBRLExact, formatCurrencyExact } from "@/components/charts/chartTheme";
import type { PositionSummary } from "@/lib/portfolio-api";

interface PositionsTableProps {
  positions: PositionSummary[];
  isLoading: boolean;
  onAddTransaction: (positionId: string, ticker: string) => void;
  onManage: (position: PositionSummary) => void;
}

function fmtBRL(v: number | string | null): string {
  if (v == null) return "—";
  return formatBRLExact(Number(v));
}

/** Linha auxiliar em moeda nativa, abaixo do valor em BRL — só para ativos
 * internacionais (a conversão automática de câmbio já acontece no backend,
 * mas até aqui só o valor convertido aparecia; sem o valor nativo junto, não
 * dá pra conferir contra a corretora/o preço que o próprio mercado mostra). */
function fmtNative(v: number | string | null, currency: string): string | null {
  if (currency === "BRL" || v == null) return null;
  return formatCurrencyExact(Number(v), currency);
}

function fmtPct(v: number | string | null): string {
  if (v == null) return "0,00%";
  const num = Number(v);
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2).replace(".", ",")}%`;
}

const COLS = ["Ativo", "Qtd", "PM", "Atual", "Valor", "P&L R$", "P&L %", "Peso", "Alvo", "Rebalance", "Ações"];

export function PositionsTable({ positions, isLoading, onAddTransaction, onManage }: PositionsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 bg-[var(--surface-2)] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return <EmptyState icon={Wallet} title="Nenhuma posição nesta carteira" description='Use "+ Ativo" para adicionar sua primeira posição.' />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {COLS.map((h) => (
              <th
                key={h}
                className={`px-2.5 py-2.5 text-[11px] font-medium text-[var(--text-muted)] tracking-[.06em] uppercase whitespace-nowrap ${
                  h === "Ativo" ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, i) => {
            const pnlPositive = pos.pnl_absolute >= 0;
            const pnlColor = pnlPositive ? "var(--accent)" : "var(--danger)";
            return (
              <tr
                key={pos.position_id}
                className={`border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)] ${pos.quantity === 0 ? "opacity-60" : ""}`}
              >
                <td className="px-2.5 py-3 text-left">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-[10px] flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-[var(--text-secondary)]"
                      style={{ background: "var(--surface-3)" }}
                    >
                      {pos.ticker.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                        <Link href={`/investments/${pos.ticker}`} className="hover:text-[var(--accent)] hover:underline underline-offset-2">
                          {pos.ticker}
                        </Link>
                        {pos.quantity === 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-normal tracking-wide"
                            style={{ background: "var(--glow)", color: "var(--accent-2)" }}
                          >
                            MONITORANDO
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-[var(--text-muted)]">{pos.asset_type}</span>
                    </div>
                  </div>
                </td>
                <td className="px-2.5 py-3 text-right tabular-nums text-[var(--text-secondary)]">{Number(pos.quantity).toFixed(4)}</td>
                <td className="px-2.5 py-3 text-right tabular-nums text-[var(--text-secondary)]">{fmtBRL(pos.avg_cost)}</td>
                <td className="px-2.5 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                  {fmtBRL(pos.current_price)}
                  {fmtNative(pos.current_price_native, pos.currency) && (
                    <span className="block text-[10.5px] text-[var(--text-muted)]">
                      {fmtNative(pos.current_price_native, pos.currency)}
                    </span>
                  )}
                </td>
                <td className="px-2.5 py-3 text-right tabular-nums font-medium text-[var(--text-primary)]">
                  {fmtBRL(pos.market_value_brl)}
                  {fmtNative(pos.market_value_native, pos.currency) && (
                    <span className="block text-[10.5px] font-normal text-[var(--text-muted)]">
                      {fmtNative(pos.market_value_native, pos.currency)}
                    </span>
                  )}
                </td>
                <td className="px-2.5 py-3 text-right tabular-nums font-medium" style={{ color: pnlColor }}>{fmtBRL(pos.pnl_absolute)}</td>
                <td className="px-2.5 py-3 text-right tabular-nums font-medium" style={{ color: pnlColor }}>{fmtPct(pos.pnl_percent)}</td>
                <td className="px-2.5 py-3 text-right tabular-nums text-[var(--text-secondary)]">{(Number(pos.weight) * 100).toFixed(1)}%</td>
                <td className="px-2.5 py-3 text-right tabular-nums text-[var(--text-secondary)]">
                  {pos.target_weight != null ? `${(Number(pos.target_weight) * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="px-2.5 py-3 text-right">
                  <RebalanceTag action={pos.rebalance_action} deltaUnits={pos.rebalance_delta_units} />
                </td>
                <td className="px-2.5 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onAddTransaction(pos.position_id, pos.ticker)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                      style={{ color: "var(--accent)", background: "var(--glow)" }}
                    >
                      Transação
                    </button>
                    <button
                      onClick={() => onManage(pos)}
                      aria-label={`Gerenciar ${pos.ticker}`}
                      title="Editar ou remover"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <Settings2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
