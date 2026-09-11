"use client";

import { Info } from "lucide-react";
import type { BenchmarkPoint, PerformancePoint } from "@/lib/portfolio-api";
import { computeRiskMetrics } from "@/lib/portfolio-risk";
import { formatPercent } from "@/lib/number-format";

interface RiskEfficiencyCardProps {
  benchmark: BenchmarkPoint[];
  performance: PerformancePoint[];
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "danger" }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
        {label} <Info size={11} className="text-[var(--text-muted)]" />
      </div>
      <div className="text-lg font-semibold mt-1 tabular-nums" style={{ color: tone === "danger" ? "var(--danger)" : "var(--text-primary)" }}>
        {value}
      </div>
      <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">{hint}</div>
    </div>
  );
}

/** Sharpe/Volatilidade/Máx.drawdown/Beta — derivados client-side da mesma
 * série que BenchmarkChart já busca (ver lib/portfolio-risk.ts). Nenhum
 * endpoint novo. */
export function RiskEfficiencyCard({ benchmark, performance }: RiskEfficiencyCardProps) {
  const { sharpe, volatilityPct, maxDrawdownPct, beta } = computeRiskMetrics(benchmark, performance);

  return (
    <div>
      <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">Risco &amp; eficiência</div>
      <div className="grid grid-cols-2 gap-4">
        <Metric
          label="Sharpe"
          value={sharpe != null ? sharpe.toFixed(2) : "—"}
          hint={sharpe != null ? (sharpe >= 1 ? "acima de 1 é bom" : "abaixo de 1") : "sem dado"}
        />
        <Metric
          label="Volatilidade"
          value={volatilityPct != null ? formatPercent(volatilityPct, 1) : "—"}
          hint="anualizada"
        />
        <Metric
          label="Máx. drawdown"
          value={maxDrawdownPct != null ? formatPercent(maxDrawdownPct, 1) : "—"}
          hint="no período"
          tone="danger"
        />
        <Metric
          label="Beta vs IBOV"
          value={beta != null ? beta.toFixed(2) : "—"}
          hint={beta != null ? (beta < 0.85 ? "defensiva" : beta > 1.15 ? "agressiva" : "neutra") : "sem dado"}
        />
      </div>
    </div>
  );
}
