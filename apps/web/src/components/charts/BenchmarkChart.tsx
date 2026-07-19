"use client";

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
import { CATEGORICAL } from "./chartTheme";

const PORTFOLIO_COLOR = CATEGORICAL[0]; // azul
const CDI_COLOR = CATEGORICAL[1]; // esmeralda
const IBOV_COLOR = CATEGORICAL[3]; // âmbar

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

const SERIES: { key: "portfolio_pct" | "cdi_pct" | "ibov_pct"; label: string; color: string }[] = [
  { key: "portfolio_pct", label: "Carteira", color: PORTFOLIO_COLOR },
  { key: "cdi_pct", label: "CDI", color: CDI_COLOR },
  { key: "ibov_pct", label: "Ibovespa", color: IBOV_COLOR },
];

function BenchmarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 shadow-sm text-xs space-y-0.5">
      <p className="font-semibold text-[var(--text-primary)]">{label ? formatDateShort(label) : ""}</p>
      {SERIES.map((s) => {
        const point = payload.find((p) => p.dataKey === s.key);
        if (point === undefined || point.value === null || point.value === undefined) return null;
        return (
          <p key={s.key} className="text-[var(--text-secondary)]">
            <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ backgroundColor: s.color }} />
            {s.label}: <span className="font-mono text-[var(--text-primary)]">{formatPctValue(point.value)}</span>
          </p>
        );
      })}
    </div>
  );
}

export function BenchmarkChart({ data }: BenchmarkChartProps) {
  const points = data.map((p) => ({
    ...p,
    portfolio_pct: Number(p.portfolio_pct),
    cdi_pct: p.cdi_pct === null ? null : Number(p.cdi_pct),
    ibov_pct: p.ibov_pct === null ? null : Number(p.ibov_pct),
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
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
            <Tooltip content={<BenchmarkTooltip />} />
            {SERIES.map((s) => (
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
      <div className="flex items-center gap-4 pt-2 text-xs text-[var(--text-secondary)]">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
