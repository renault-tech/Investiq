import { KpiCard } from "./KpiCard";
import type { PortfolioSummary } from "@/lib/portfolio-api";

interface LeftPanelProps {
  summary: PortfolioSummary | undefined;
  isLoading: boolean;
}

function fmt(value: number | string | null): string {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function fmtPct(value: number | string | null): string {
  if (value == null) return "0.00%";
  const num = Number(value);
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

export function LeftPanel({ summary, isLoading }: LeftPanelProps) {
  if (isLoading) {
    return (
      <div className="p-3 flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const pnlPositive = (summary?.total_pnl_absolute ?? 0) >= 0;
  const top5 = [...(summary?.positions ?? [])]
    .sort((a, b) => b.market_value_brl - a.market_value_brl)
    .slice(0, 5);

  return (
    <div className="p-3 flex flex-col gap-2">
      <KpiCard
        label="Valor de Mercado"
        value={fmt(summary?.total_market_value_brl ?? 0)}
      />
      <KpiCard
        label="Total Investido"
        value={fmt(summary?.total_invested_brl ?? 0)}
      />
      <KpiCard
        label="P&L"
        value={fmt(summary?.total_pnl_absolute ?? 0)}
        subColor={pnlPositive ? "green" : "red"}
      />
      <KpiCard
        label="Retorno"
        value={fmtPct(summary?.total_pnl_percent ?? 0)}
        subColor={pnlPositive ? "green" : "red"}
      />

      {top5.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 mt-1">
          <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-2">
            Top Posições
          </p>
          {top5.map((pos) => (
            <div key={pos.asset_id} className="flex justify-between items-center py-1">
              <span className="text-[11px] font-semibold text-[var(--text-primary)]">{pos.ticker}</span>
              <span
                className={`text-[10px] ${
                  pos.pnl_percent >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {fmtPct(pos.pnl_percent)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
