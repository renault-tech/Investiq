import type { Bar, AssetIndicators } from "./market-api";

/** Leituras derivadas dos indicadores já calculados pelo backend
 * (RSI/MACD/SMA/EMA em /market/assets/{ticker}/indicators) — nada aqui
 * inventa dado novo, só interpreta o que já existe em texto curto. */

export function rsiStatus(rsi: number | null): { label: string; tone: "buy" | "sell" | "neutral" } {
  if (rsi == null) return { label: "sem dado", tone: "neutral" };
  if (rsi >= 70) return { label: "perto de sobrecompra", tone: "sell" };
  if (rsi <= 30) return { label: "perto de sobrevenda", tone: "buy" };
  return { label: "neutro", tone: "neutral" };
}

export function macdStatus(histogramNow: number | null, histogramPrev: number | null): { label: string; tone: "buy" | "sell" | "neutral" } {
  if (histogramNow == null) return { label: "sem dado", tone: "neutral" };
  if (histogramPrev != null && histogramPrev <= 0 && histogramNow > 0) return { label: "cruzamento de alta", tone: "buy" };
  if (histogramPrev != null && histogramPrev >= 0 && histogramNow < 0) return { label: "cruzamento de baixa", tone: "sell" };
  return { label: histogramNow >= 0 ? "acima da linha de sinal" : "abaixo da linha de sinal", tone: "neutral" };
}

/** Quantas médias (SMA20/50/200 + EMA9/21 — as 5 que o endpoint calcula por
 * padrão) o último fechamento está acima de — "compradoras" no sentido de
 * tendência de alta por aquela média. */
export function movingAveragesAbove(lastClose: number, indicators: AssetIndicators): { above: number; total: number } {
  const series = [...indicators.sma, ...indicators.ema];
  let above = 0;
  let total = 0;
  for (const s of series) {
    const last = s.points.filter((p) => p.value != null).slice(-1)[0];
    if (!last) continue;
    total++;
    if (lastClose > (last.value as number)) above++;
  }
  return { above, total };
}

/** Desvio-padrão dos retornos diários dos últimos N pregões, em %. Não
 * anualizado — "30d" na tela já deixa claro a janela, anualizar misturaria
 * com o Sharpe/Volatilidade anualizada de Investimentos (métrica diferente,
 * mesmo nome de exibição intencionalmente distinto: "30d" vs "anualizada"). */
export function volatility30d(bars: Bar[]): number | null {
  const closes = bars.slice(-31).map((b) => b.close);
  if (closes.length < 2) return null;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

export interface TradeSetup {
  ticker: string;
  action: "buy" | "sell" | "watch";
  label: string;
  detail: string;
  strength: number;
}

/** Radar de setups: heurística simples e determinística sobre RSI/MACD/SMA50
 * já calculados — não é recomendação, é leitura mecânica de 3 regras fixas
 * (nessa ordem de prioridade: RSI extremo, depois rompimento de SMA50).
 * Muitos tickers vão cair em "observar" — não há sinal a maior parte do
 * tempo, e a UI não deveria inventar um forçado. */
export function computeSetup(ticker: string, bars: Bar[], indicators: AssetIndicators): TradeSetup | null {
  if (bars.length < 2) return null;
  const lastClose = bars[bars.length - 1].close;
  const rsiPoints = indicators.rsi.filter((p) => p.rsi != null);
  const lastRsi = rsiPoints.slice(-1)[0]?.rsi ?? null;
  const sma50 = indicators.sma.find((s) => s.period === 50);
  const sma50Points = sma50?.points.filter((p) => p.value != null) ?? [];
  const lastSma50 = sma50Points.slice(-1)[0]?.value ?? null;
  const prevSma50 = sma50Points.slice(-2)[0]?.value ?? null;
  const prevClose = bars[bars.length - 2].close;

  if (lastRsi != null && lastRsi <= 30) {
    return { ticker, action: "buy", label: "COMPRA", detail: `IFR em ${lastRsi.toFixed(0)}, região de sobrevenda.`, strength: Math.min(10, (30 - lastRsi) / 3 + 5) };
  }
  if (lastRsi != null && lastRsi >= 70) {
    return { ticker, action: "sell", label: "VENDA", detail: `IFR em ${lastRsi.toFixed(0)}, região de sobrecompra.`, strength: Math.min(10, (lastRsi - 70) / 3 + 5) };
  }
  if (lastSma50 != null && prevSma50 != null) {
    if (prevClose <= prevSma50 && lastClose > lastSma50) {
      return { ticker, action: "buy", label: "COMPRA", detail: "Rompeu a média de 50 dias.", strength: 6.5 };
    }
    if (prevClose >= prevSma50 && lastClose < lastSma50) {
      return { ticker, action: "sell", label: "VENDA", detail: "Perdeu a média de 50 dias.", strength: 6.5 };
    }
  }
  return { ticker, action: "watch", label: "OBSERVAR", detail: "Sem sinal claro no momento.", strength: 3 };
}
