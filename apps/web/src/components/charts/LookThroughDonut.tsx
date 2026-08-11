"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { LookThroughBucket } from "@/lib/portfolio-api";
import { CATEGORICAL, MAX_SLICES, formatBRL, formatPct } from "./chartTheme";

interface LookThroughDonutProps {
  buckets: LookThroughBucket[];
  ariaLabel: string;
}

type Slice = { name: string; value: number; weight: number; color: string };

function buildSlices(buckets: LookThroughBucket[]): Slice[] {
  const sorted = [...buckets].sort((a, b) => b.value_brl - a.value_brl);
  const head = sorted.slice(0, MAX_SLICES - 1);
  const tail = sorted.slice(MAX_SLICES - 1);

  const slices: Slice[] = head.map((b, i) => ({
    name: b.label,
    value: b.value_brl,
    weight: b.weight,
    color: CATEGORICAL[i],
  }));

  if (tail.length === 1) {
    slices.push({ name: tail[0].label, value: tail[0].value_brl, weight: tail[0].weight, color: CATEGORICAL[slices.length] });
  } else if (tail.length > 1) {
    slices.push({
      name: "Outros",
      value: tail.reduce((sum, b) => sum + b.value_brl, 0),
      weight: tail.reduce((sum, b) => sum + b.weight, 0),
      color: CATEGORICAL[slices.length],
    });
  }
  return slices;
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: { payload: Slice }[] }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-[var(--shadow)] text-xs">
      <p className="font-semibold text-[var(--text-primary)]">{slice.name}</p>
      <p className="text-[var(--text-secondary)] tabular-nums">
        {formatBRL(slice.value)} · {formatPct(slice.weight)}
      </p>
    </div>
  );
}

export function LookThroughDonut({ buckets, ariaLabel }: LookThroughDonutProps) {
  const slices = useMemo(() => buildSlices(buckets), [buckets]);

  return (
    <div className="flex h-full items-center gap-4">
      <div className="h-full flex-1 min-w-0" role="img" aria-label={`${ariaLabel}: ${slices.map((s) => `${s.name} ${formatPct(s.weight)}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={2}
              cornerRadius={6}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="shrink-0 space-y-2.5 pr-1 max-h-full overflow-y-auto">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-[var(--text-secondary)]">{slice.name}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-[var(--text-primary)]">{formatPct(slice.weight)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
