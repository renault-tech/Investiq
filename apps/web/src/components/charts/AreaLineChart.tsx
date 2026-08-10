"use client";

import { useId } from "react";
import { buildSmoothPath } from "@/lib/svg-path";

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  gridRows?: number;
  className?: string;
}

/** Gráfico de área/linha suavizado (patrimônio, carteira, projeção) —
 * viewBox fixo em `width`×`height`, escala fluida via preserveAspectRatio. */
export function AreaLineChart({
  values,
  width = 760,
  height = 200,
  color = "var(--accent)",
  gridRows = 4,
  className = "",
}: Props) {
  const gradientId = useId();
  if (values.length < 2) {
    return <div className={className} style={{ height }} />;
  }
  const areaPath = buildSmoothPath(values, width, height, true);
  const linePath = buildSmoothPath(values, width, height, false);
  const rowGap = height / (gridRows + 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height, display: "block" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: gridRows }).map((_, i) => (
        <path
          key={i}
          d={`M0 ${(rowGap * (i + 1)).toFixed(1)}H${width}`}
          stroke="var(--grid-line)"
          strokeWidth={1}
        />
      ))}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-draw"
      />
    </svg>
  );
}
