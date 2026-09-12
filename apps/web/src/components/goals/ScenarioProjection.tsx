"use client";

import { useState } from "react";
import { useMask } from "@/hooks/useMask";
import { formatBRLCompact } from "@/components/charts/chartTheme";

const CONTRIB_OPTS = [2000, 4000, 8000, 15000];
const HORIZON_YEARS = 20;

// Mesmas três taxas reais (acima da inflação) já usadas no simulador de
// independência financeira (FireSimulator) — reaproveitadas aqui como
// Estresse/Base/Otimista em vez de inventar um novo conjunto de números.
const SCENARIOS = [
  { key: "estresse", label: "Estresse", rate: 0.04, color: "var(--danger)" },
  { key: "base", label: "Base", rate: 0.06, color: "var(--text-secondary)" },
  { key: "otimista", label: "Otimista", rate: 0.08, color: "var(--accent)" },
] as const;

function projectedValue(currentInvested: number, monthlyContribution: number, annualRate: number, years: number): number {
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  let balance = currentInvested;
  for (let m = 0; m < years * 12; m++) balance = balance * (1 + monthlyRate) + monthlyContribution;
  return balance;
}

/** Projeção de patrimônio em horizonte fixo de 20 anos sob três taxas reais
 * de retorno — puro juros compostos a partir do patrimônio investido atual,
 * sem endpoint novo no backend. Mesma lógica do FireSimulator, horizonte
 * fixo em vez de "anos até o alvo". */
export function ScenarioProjection({ currentInvested }: { currentInvested: number }) {
  const [contrib, setContrib] = useState(CONTRIB_OPTS[1]);
  const mask = useMask();

  const values = SCENARIOS.map((s) => ({ ...s, value: projectedValue(currentInvested, contrib, s.rate, HORIZON_YEARS) }));
  const maxValue = Math.max(...values.map((v) => v.value), 1);

  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up">
      <div className="text-sm font-semibold text-[var(--text-primary)]">Cenários em 20 anos</div>
      <div className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
        Onde seu patrimônio poderia chegar sob três taxas reais de retorno diferentes
      </div>

      <div className="flex items-end gap-4 mt-5.5" style={{ height: 140 }}>
        {values.map((v) => (
          <div key={v.key} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
            <span className="text-[12px] font-mono font-medium tabular-nums text-[var(--text-primary)]">
              {mask(formatBRLCompact(v.value))}
            </span>
            <div className="w-full flex items-end" style={{ height: 90 }}>
              <div className="w-full rounded-t-[8px] animate-grow-y" style={{ height: `${(v.value / maxValue) * 100}%`, background: v.color }} />
            </div>
            <span className="text-[11px] text-[var(--text-secondary)]">{v.label}</span>
            <span className="text-[10px] text-[var(--text-muted)]">{(v.rate * 100).toFixed(0)}% a.a.</span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] text-[var(--text-secondary)] flex-1">Aporte mensal considerado</span>
          <span className="font-mono text-[11.5px]" style={{ color: "var(--accent)" }}>{mask(formatBRLCompact(contrib))}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CONTRIB_OPTS.map((o) => (
            <button
              key={o}
              onClick={() => setContrib(o)}
              className="px-2.5 py-1 rounded-md text-[11px]"
              style={{ background: contrib === o ? "var(--surface-3)" : "var(--surface-2)", color: contrib === o ? "var(--text-primary)" : "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {mask(formatBRLCompact(o))}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 pt-3.5 text-[11.5px] leading-[1.55] text-[var(--text-secondary)]" style={{ borderTop: "1px solid var(--border)" }}>
        Projeção com retorno real constante — mercado real varia ano a ano; use como referência de ordem de grandeza, não como promessa.
      </p>
    </div>
  );
}
