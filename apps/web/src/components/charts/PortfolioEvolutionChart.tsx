"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PerformancePoint } from "@/lib/portfolio-api";
import { formatBRL, formatBRLCompact } from "./chartTheme";

const VALUE_COLOR = "var(--accent)";
const INVESTED_COLOR = "var(--text-muted)";

interface PortfolioEvolutionChartProps {
  data: PerformancePoint[];
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function EvolutionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload.find((p) => p.dataKey === "total_value")?.value;
  const invested = payload.find((p) => p.dataKey === "total_invested")?.value;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-[var(--shadow)] text-xs space-y-0.5">
      <p className="font-semibold text-[var(--text-primary)]">{label ? formatDateShort(label) : ""}</p>
      {value !== undefined && (
        <p className="text-[var(--text-secondary)]">
          <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ backgroundColor: VALUE_COLOR }} />
          Valor: <span className="tabular-nums text-[var(--text-primary)]">{formatBRL(value)}</span>
        </p>
      )}
      {invested !== undefined && (
        <p className="text-[var(--text-secondary)]">
          <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ backgroundColor: INVESTED_COLOR }} />
          Aportado: <span className="tabular-nums text-[var(--text-primary)]">{formatBRL(invested)}</span>
        </p>
      )}
    </div>
  );
}

export function PortfolioEvolutionChart({ data }: PortfolioEvolutionChartProps) {
  const points = data.map((p) => ({
    ...p,
    total_value: Number(p.total_value),
    total_invested: Number(p.total_invested),
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="evolutionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VALUE_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={VALUE_COLOR} stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              tickFormatter={(v: number) => formatBRLCompact(v)}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip content={<EvolutionTooltip />} />
            <Area
              type="monotone"
              dataKey="total_value"
              name="Valor da carteira"
              stroke={VALUE_COLOR}
              strokeWidth={2}
              fill="url(#evolutionFill)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              type="stepAfter"
              dataKey="total_invested"
              name="Total aportado"
              stroke={INVESTED_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              fill="none"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 pt-2 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: VALUE_COLOR }} />
          Valor da carteira
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed" style={{ borderColor: INVESTED_COLOR }} />
          Total aportado
        </span>
      </div>
    </div>
  );
}
