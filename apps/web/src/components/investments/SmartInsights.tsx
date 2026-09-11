"use client";

import { AlertTriangle, ArrowLeftRight, TrendingUp, Sparkles } from "lucide-react";
import type { PositionSummary } from "@/lib/portfolio-api";
import { useMarketQuotes } from "@/hooks/useAssetData";
import { formatPercent } from "@/lib/number-format";

interface SmartInsightsProps {
  positions: PositionSummary[];
  rebalanceCount: number;
}

interface Insight {
  key: string;
  icon: typeof AlertTriangle;
  label: string;
  tone: "warning" | "accent";
  text: string;
}

const CONCENTRATION_LIMIT = 0.15;

/** Leituras derivadas do que a carteira já calcula — concentração (peso
 * real vs um limite fixo de 15%), rebalanceamento pendente (mesmo dado do
 * card de Alocação) e maior variação do dia (cotação ao vivo). Nenhuma
 * "eficiência de taxas" ou "vencimento de renda fixa" aqui — o modelo de
 * dados não guarda taxa de administração nem data de vencimento por
 * ativo, e inventar esses números seria pior que não mostrar o insight. */
export function SmartInsights({ positions, rebalanceCount }: SmartInsightsProps) {
  const openPositions = positions.filter((p) => p.quantity > 0);
  const tickers = openPositions.map((p) => p.ticker);
  const { data: quotes = [] } = useMarketQuotes(tickers);
  const quoteByTicker = new Map(quotes.map((q) => [q.ticker, q]));

  const insights: Insight[] = [];

  const maxPosition = openPositions.slice().sort((a, b) => Number(b.weight) - Number(a.weight))[0];
  if (maxPosition && Number(maxPosition.weight) > CONCENTRATION_LIMIT) {
    insights.push({
      key: "concentration",
      icon: AlertTriangle,
      label: "CONCENTRAÇÃO",
      tone: "warning",
      text: `${maxPosition.ticker} responde por ${formatPercent(Number(maxPosition.weight) * 100, 1)} da carteira. Limite de referência: ${formatPercent(CONCENTRATION_LIMIT * 100, 0)}.`,
    });
  }

  if (rebalanceCount > 0) {
    insights.push({
      key: "rebalance",
      icon: ArrowLeftRight,
      label: "REBALANCEAMENTO",
      tone: "accent",
      text: `${rebalanceCount} posiç${rebalanceCount > 1 ? "ões" : "ão"} fora do peso-alvo definido.`,
    });
  }

  let biggestMove: { ticker: string; changePct: number } | null = null;
  for (const [ticker, q] of quoteByTicker) {
    if (q.change_pct == null) continue;
    if (!biggestMove || Math.abs(q.change_pct) > Math.abs(biggestMove.changePct)) {
      biggestMove = { ticker, changePct: q.change_pct };
    }
  }
  if (biggestMove) {
    insights.push({
      key: "movement",
      icon: TrendingUp,
      label: "MAIOR VARIAÇÃO DO DIA",
      tone: biggestMove.changePct >= 0 ? "accent" : "warning",
      text: `${biggestMove.ticker} ${biggestMove.changePct >= 0 ? "sobe" : "cai"} ${formatPercent(Math.abs(biggestMove.changePct), 2)} hoje.`,
    });
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4">
        <Sparkles size={14} className="text-[var(--accent)]" />
        <div className="text-sm font-semibold text-[var(--text-primary)]">Ações inteligentes</div>
        {insights.length > 0 && <span className="text-[10.5px] text-[var(--text-muted)]">{insights.length}</span>}
      </div>
      {insights.length === 0 ? (
        <p className="text-[12px] text-[var(--text-muted)]">Nada pra revisar agora — carteira dentro do esperado.</p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div key={insight.key} className="pb-3 border-b border-[var(--border)] last:border-0 last:pb-0">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: insight.tone === "warning" ? "var(--warning)" : "var(--accent)" }}>
                <insight.icon size={12} /> {insight.label}
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">{insight.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
