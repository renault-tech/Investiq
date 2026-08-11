"use client";

interface SparklineProps {
  closes: number[];
  width?: number;
  height?: number;
}

/** Mini-gráfico de linha para uma lista de fechamentos — SVG puro em vez de
 * recharts: numa linha de tabela repetida N vezes na watchlist, o peso e o
 * overhead de montagem do recharts por linha não valem a pena para um
 * traço sem eixos, tooltip ou interação. */
export function Sparkline({ closes, width = 72, height = 28 }: SparklineProps) {
  if (closes.length < 2) {
    return <div style={{ width, height }} />;
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const step = width / (closes.length - 1);

  const points = closes
    .map((value, i) => `${(i * step).toFixed(1)},${(height - ((value - min) / range) * height).toFixed(1)}`)
    .join(" ");

  const positive = closes[closes.length - 1] >= closes[0];
  const color = positive ? "var(--accent)" : "var(--danger)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
