"use client";

import { DonutRing } from "./DonutRing";
import { CATEGORICAL, MAX_SLICES, formatBRL, formatPct } from "./chartTheme";
import { useUIStore, maskValue } from "@/store/useUIStore";

export interface BreakdownItem {
  name: string;
  value: number;
  weight: number;
}

interface DonutBreakdownProps {
  items: BreakdownItem[];
  ariaLabel: string;
  /** Colunas da legenda em telas largas — 2 para um card de linha inteira. */
  legendColumns?: 1 | 2;
  size?: number;
}

type Slice = BreakdownItem & { color: string };

/** Agrupa a cauda em "Outros" a partir de MAX_SLICES — um donut com 15 fatias
 *  finas não comunica nada. */
export function buildSlices(items: BreakdownItem[]): Slice[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, MAX_SLICES - 1);
  const tail = sorted.slice(MAX_SLICES - 1);
  const slices: Slice[] = head.map((s, i) => ({ ...s, color: CATEGORICAL[i] }));
  if (tail.length === 1) {
    slices.push({ ...tail[0], color: CATEGORICAL[slices.length] });
  } else if (tail.length > 1) {
    slices.push({
      name: "Outros",
      value: tail.reduce((sum, s) => sum + s.value, 0),
      weight: tail.reduce((sum, s) => sum + s.weight, 0),
      color: CATEGORICAL[slices.length],
    });
  }
  return slices;
}

/** Donut de tamanho fixo + legenda com valor, peso e barra.
 *
 * Substitui os dois donuts em recharts (Alocação e Raio-X) que esticavam até
 * a altura do card — um anel de 300px com uma legenda de uma linha só
 * desperdiçava o card inteiro. Aqui o anel tem tamanho fixo e a informação
 * fica na legenda, que é o que a pessoa realmente lê. SVG puro: não carrega
 * o recharts para um gráfico estático. */
export function DonutBreakdown({ items, ariaLabel, legendColumns = 1, size = 156 }: DonutBreakdownProps) {
  const privacy = useUIStore((s) => s.privacy);
  const slices = buildSlices(items);
  const top = slices[0];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div
        className="relative shrink-0 mx-auto sm:mx-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${ariaLabel}: ${slices.map((s) => `${s.name} ${formatPct(s.weight)}`).join(", ")}`}
      >
        <DonutRing segments={slices.map((s) => ({ fraction: s.weight, color: s.color }))} size={size} strokeWidth={Math.round(size * 0.11)} />
        {top && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div className="font-mono text-[20px] font-medium text-[var(--text-primary)] tabular-nums">{formatPct(top.weight)}</div>
            <div className="text-[10.5px] text-[var(--text-muted)] truncate max-w-full">{top.name}</div>
          </div>
        )}
      </div>
      <ul className={`flex-1 min-w-[200px] grid gap-x-6 gap-y-2.5 ${legendColumns === 2 ? "lg:grid-cols-2" : ""}`}>
        {slices.map((slice) => (
          <li key={slice.name} className="min-w-0">
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="text-[var(--text-secondary)] truncate">{slice.name}</span>
              <span className="ml-auto pl-3 text-[11.5px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">{maskValue(formatBRL(slice.value), privacy)}</span>
              <span className="w-[52px] text-right font-semibold tabular-nums text-[var(--text-primary)]">{formatPct(slice.weight)}</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--surface-3)] overflow-hidden mt-1.5">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, slice.weight * 100)}%`, background: slice.color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
