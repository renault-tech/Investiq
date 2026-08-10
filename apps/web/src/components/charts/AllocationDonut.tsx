"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { AllocationSlice } from "@/lib/portfolio-api";
import { CATEGORICAL, MAX_SLICES, assetTypeLabel, formatBRL, formatPct } from "./chartTheme";

interface AllocationDonutProps {
  allocation: AllocationSlice[];
}

type Slice = { name: string; value: number; weight: number; color: string };

function buildSlices(allocation: AllocationSlice[]): Slice[] {
  const sorted = [...allocation].sort((a, b) => Number(b.value) - Number(a.value));
  const head = sorted.slice(0, MAX_SLICES - 1);
  const tail = sorted.slice(MAX_SLICES - 1);

  const slices: Slice[] = head.map((s, i) => ({
    name: assetTypeLabel(s.asset_type),
    value: Number(s.value),
    weight: Number(s.weight),
    color: CATEGORICAL[i],
  }));

  if (tail.length === 1) {
    slices.push({
      name: assetTypeLabel(tail[0].asset_type),
      value: Number(tail[0].value),
      weight: Number(tail[0].weight),
      color: CATEGORICAL[slices.length],
    });
  } else if (tail.length > 1) {
    slices.push({
      name: "Outros",
      value: tail.reduce((sum, s) => sum + Number(s.value), 0),
      weight: tail.reduce((sum, s) => sum + Number(s.weight), 0),
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

export function AllocationDonut({ allocation }: AllocationDonutProps) {
  const slices = useMemo(() => buildSlices(allocation), [allocation]);

  return (
    <div className="flex h-full items-center gap-4">
      <div className="h-full flex-1 min-w-0" role="img" aria-label={`Alocação da carteira: ${slices.map((s) => `${s.name} ${formatPct(s.weight)}`).join(", ")}`}>
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
