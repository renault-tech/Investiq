import type { BenchmarkPoint, PerformancePoint } from "./portfolio-api";

export interface RiskMetrics {
  sharpe: number | null;
  volatilityPct: number | null;
  maxDrawdownPct: number | null;
  beta: number | null;
}

function dailyReturns(cumulativePct: (number | null)[]): number[] {
  // cumulativePct já vem como "% acumulado desde o início" (mesma série do
  // BenchmarkChart) — diferença entre pontos consecutivos aproxima o
  // retorno do período entre eles. Não é geometricamente exato (o correto
  // seria (1+r2)/(1+r1)-1), mas para o intervalo curto entre pregões o erro
  // é desprezível e evita reimportar toda a série de valor absoluto.
  const returns: number[] = [];
  for (let i = 1; i < cumulativePct.length; i++) {
    const prev = cumulativePct[i - 1];
    const curr = cumulativePct[i];
    if (prev == null || curr == null) continue;
    returns.push((curr - prev) / 100);
  }
  return returns;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Sharpe, volatilidade (anualizada, √252 pregões), máx. drawdown e beta vs
 * IBOV — tudo derivado da série que BenchmarkChart já usa (portfolio_pct/
 * cdi_pct/ibov_pct acumulados desde o início do período). CDI médio do
 * período como taxa livre de risco. Sem endpoint novo. */
export function computeRiskMetrics(benchmark: BenchmarkPoint[], performance: PerformancePoint[]): RiskMetrics {
  if (benchmark.length < 3) return { sharpe: null, volatilityPct: null, maxDrawdownPct: null, beta: null };

  const portfolioReturns = dailyReturns(benchmark.map((b) => b.portfolio_pct));
  const cdiReturns = dailyReturns(benchmark.map((b) => b.cdi_pct));
  const ibovReturns = dailyReturns(benchmark.map((b) => b.ibov_pct));

  const volDaily = stdev(portfolioReturns);
  const volatilityPct = volDaily * Math.sqrt(252) * 100;

  const meanPortfolio = portfolioReturns.reduce((a, b) => a + b, 0) / (portfolioReturns.length || 1);
  const meanCdi = cdiReturns.length > 0 ? cdiReturns.reduce((a, b) => a + b, 0) / cdiReturns.length : 0;
  const excessAnnual = (meanPortfolio - meanCdi) * 252;
  const sharpe = volatilityPct > 0 ? excessAnnual / (volatilityPct / 100) : null;

  let beta: number | null = null;
  if (ibovReturns.length === portfolioReturns.length && ibovReturns.length > 1) {
    const meanIbov = ibovReturns.reduce((a, b) => a + b, 0) / ibovReturns.length;
    let covariance = 0;
    let varianceIbov = 0;
    for (let i = 0; i < ibovReturns.length; i++) {
      covariance += (portfolioReturns[i] - meanPortfolio) * (ibovReturns[i] - meanIbov);
      varianceIbov += (ibovReturns[i] - meanIbov) ** 2;
    }
    beta = varianceIbov > 0 ? covariance / varianceIbov : null;
  }

  // Máx. drawdown a partir do valor absoluto da carteira (mais preciso que
  // o % acumulado, que já é relativo ao início do período do gráfico).
  let maxDrawdownPct: number | null = null;
  if (performance.length > 1) {
    let peak = performance[0].total_value;
    let maxDrop = 0;
    for (const p of performance) {
      if (p.total_value > peak) peak = p.total_value;
      const drop = peak > 0 ? (p.total_value - peak) / peak : 0;
      if (drop < maxDrop) maxDrop = drop;
    }
    maxDrawdownPct = maxDrop * 100;
  }

  return { sharpe, volatilityPct, maxDrawdownPct, beta };
}
