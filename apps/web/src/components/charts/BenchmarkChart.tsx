"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { BenchmarkPoint } from "@/lib/portfolio-api";

interface BenchmarkChartProps {
  data: BenchmarkPoint[];
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatPctValue(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

type SeriesKey = "portfolio_pct" | "cdi_pct" | "ibov_pct" | "nasdaq_pct" | "sp500_pct";

// Paleta categórica fixa (--chart-*, globals.css) — deliberadamente
// independente de --accent, que é personalizável em Configurações e colidia
// visualmente com o --accent-2 fixo que o CDI usava antes (ambos liam como
// "azul" quando o usuário escolhia a cor de destaque azul). "Carteira" vem
// primeiro e não pode ser ocultada — é a linha de referência de tudo mais.
const SERIES: { key: SeriesKey; label: string; color: string; toggleable: boolean }[] = [
  { key: "portfolio_pct", label: "Carteira", color: "var(--chart-portfolio)", toggleable: false },
  { key: "cdi_pct", label: "CDI", color: "var(--chart-cdi)", toggleable: true },
  { key: "ibov_pct", label: "Ibovespa", color: "var(--chart-ibov)", toggleable: true },
  { key: "nasdaq_pct", label: "Nasdaq", color: "var(--chart-nasdaq)", toggleable: true },
  { key: "sp500_pct", label: "S&P 500", color: "var(--chart-sp500)", toggleable: true },
];

const DEFAULT_VISIBLE: SeriesKey[] = ["portfolio_pct", "cdi_pct", "ibov_pct"];

function BenchmarkTooltip({
  active,
  payload,
  label,
  visible,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
  visible: Set<SeriesKey>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-[var(--shadow)] text-xs space-y-0.5">
      <p className="font-semibold text-[var(--text-primary)]">{label ? formatDateShort(label) : ""}</p>
      {SERIES.filter((s) => visible.has(s.key)).map((s) => {
        const point = payload.find((p) => p.dataKey === s.key);
        if (point === undefined || point.value === null || point.value === undefined) return null;
        return (
          <p key={s.key} className="text-[var(--text-secondary)]">
            <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ backgroundColor: s.color }} />
            {s.label}: <span className="tabular-nums text-[var(--text-primary)]">{formatPctValue(point.value)}</span>
          </p>
        );
      })}
    </div>
  );
}

export function BenchmarkChart({ data }: BenchmarkChartProps) {
  const [visible, setVisible] = useState<Set<SeriesKey>>(new Set(DEFAULT_VISIBLE));

  const toggle = (key: SeriesKey) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const points = data.map((p) => ({
    ...p,
    portfolio_pct: Number(p.portfolio_pct),
    cdi_pct: p.cdi_pct === null ? null : Number(p.cdi_pct),
    ibov_pct: p.ibov_pct === null ? null : Number(p.ibov_pct),
    nasdaq_pct: p.nasdaq_pct === null ? null : Number(p.nasdaq_pct),
    sp500_pct: p.sp500_pct === null ? null : Number(p.sp500_pct),
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Comparar com: legenda clicável — "Carteira" é sempre a referência e
          não pode ser ocultada; os demais benchmarks ligam/desligam. */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2.5">
        <span className="text-[11px] text-[var(--text-muted)] mr-0.5">Comparar com:</span>
        {SERIES.map((s) => {
          const isVisible = visible.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              disabled={!s.toggleable}
              onClick={() => toggle(s.key)}
              aria-pressed={isVisible}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] border transition-colors ${
                s.toggleable ? "cursor-pointer" : "cursor-default"
              } ${
                isVisible
                  ? "border-[var(--border-strong)] text-[var(--text-primary)]"
                  : "border-[var(--border)] text-[var(--text-muted)] opacity-50"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--grid-line)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={48}
            />
            <YAxis
              tickFormatter={(v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            <Tooltip content={<BenchmarkTooltip visible={visible} />} />
            {SERIES.filter((s) => visible.has(s.key)).map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="pt-1.5 text-[11px] text-[var(--text-muted)]">
        Retorno simplificado: aportes feitos durante o período aparecem como variação na
        carteira, sem ajuste ponderado pelo tempo (TWR).
      </p>
    </div>
  );
}
