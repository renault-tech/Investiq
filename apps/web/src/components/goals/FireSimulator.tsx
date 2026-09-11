"use client";

import { useState } from "react";
import { useMask } from "@/hooks/useMask";
import { formatBRLCompact } from "@/components/charts/chartTheme";

const CONTRIB_OPTS = [2000, 4000, 8000, 15000];
const RATE_OPTS = [0.04, 0.06, 0.08]; // retorno real ao ano, após inflação
const SPEND_OPTS = [3000, 5000, 8000, 12000];

/** Anos até a independência financeira pela regra dos 4%: patrimônio-alvo =
 * gasto mensal desejado × 12 / 0.04. Juros compostos mensais até atingir o
 * alvo, partindo do patrimônio investido atual (não o líquido — reserva de
 * emergência em conta não deveria contar pra esta conta). */
function yearsToTarget(currentInvested: number, monthlyContribution: number, annualRate: number, target: number): number {
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  let balance = currentInvested, months = 0;
  while (balance < target && months < 12 * 80) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    months++;
  }
  return months / 12;
}

/** Cálculo puro (regra dos 4% + juros compostos) — sem endpoint, sem
 * backend, feito inteiramente aqui. Único dado real que entra é o
 * patrimônio investido atual, já disponível via getPortfolioSummary
 * (mesma fonte que a Visão Geral usa). */
export function FireSimulator({ currentInvested }: { currentInvested: number }) {
  const [contrib, setContrib] = useState(CONTRIB_OPTS[1]);
  const [rate, setRate] = useState(RATE_OPTS[1]);
  const [spend, setSpend] = useState(SPEND_OPTS[1]);
  const mask = useMask();

  const target = (spend * 12) / 0.04;
  const years = yearsToTarget(currentInvested, contrib, rate, target);
  const wholeYears = Math.floor(years);
  const months = Math.round((years - wholeYears) * 12);

  const bars = Array.from({ length: 20 }, (_, i) => {
    const t = (i / 19) * years;
    const monthlyRate = Math.pow(1 + rate, 1 / 12) - 1;
    let balance = currentInvested;
    for (let m = 0; m < t * 12; m++) balance = balance * (1 + monthlyRate) + contrib;
    return { h: Math.min(100, (balance / target) * 100), label: i % 4 === 0 ? `+${Math.round(t)}a` : "" };
  });

  return (
    <div className="rounded-[18px] p-5.5" style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,color-mix(in srgb,var(--accent) 7%,transparent),var(--t1))" }}>
      <div className="flex items-center justify-between gap-2.5">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">Independência financeira</div>
          <div className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">Quando a carteira paga suas contas sozinha</div>
        </div>
        <span className="text-[10px] font-semibold rounded-md px-1.5 py-0.5" style={{ color: "var(--accent)", background: "var(--glow)" }}>SIMULADOR</span>
      </div>

      <div className="flex items-baseline gap-3 mt-4.5 flex-wrap">
        <div>
          <div className="font-mono font-medium text-[clamp(30px,3.6vw,44px)] tracking-[-.04em] leading-none whitespace-nowrap" style={{ color: "var(--accent)" }}>
            {wholeYears} anos{months > 0 ? ` e ${months} m` : ""}
          </div>
          <div className="text-[11.5px] text-[var(--text-secondary)] mt-1.5">até a liberdade</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10.5px] text-[var(--text-secondary)]">Patrimônio alvo</div>
          <div className="font-mono text-[18px] mt-0.5 whitespace-nowrap text-[var(--text-primary)]">{mask(formatBRLCompact(target))}</div>
          <div className="text-[10.5px] text-[var(--text-secondary)] mt-0.5">regra dos 4%</div>
        </div>
      </div>

      <div className="flex items-end gap-1 mt-5" style={{ height: 104 }}>
        {bars.map((b, i) => (
          <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1">
            <div className="w-full rounded-t-[3px]" style={{ height: `${b.h}%`, background: i === bars.length - 1 ? "var(--accent)" : "var(--surface-3)" }} />
            <span className="font-mono text-[8px] text-[var(--text-muted)]">{b.label}</span>
          </div>
        ))}
      </div>

      {[
        { label: "Aporte mensal", value: contrib, opts: CONTRIB_OPTS, set: setContrib, fmt: (v: number) => mask(formatBRLCompact(v)) },
        { label: "Retorno real ao ano", value: rate, opts: RATE_OPTS, set: setRate, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
        { label: "Quanto quer receber por mês", value: spend, opts: SPEND_OPTS, set: setSpend, fmt: (v: number) => mask(formatBRLCompact(v)) },
      ].map((row) => (
        <div key={row.label} className="mt-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] text-[var(--text-secondary)] flex-1">{row.label}</span>
            <span className="font-mono text-[11.5px]" style={{ color: "var(--accent)" }}>{row.fmt(row.value)}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {row.opts.map((o) => (
              <button
                key={o}
                onClick={() => row.set(o)}
                className="px-2.5 py-1 rounded-md text-[11px]"
                style={{ background: row.value === o ? "var(--surface-3)" : "var(--surface-2)", color: row.value === o ? "var(--text-primary)" : "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {row.fmt(o)}
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="mt-4.5 pt-3.5 text-[12px] leading-[1.55] text-[var(--text-secondary)]" style={{ borderTop: "1px solid var(--border)" }}>
        Projeção com retorno real constante ({(rate * 100).toFixed(0)}% a.a. acima da inflação) — cenários de mercado
        variam; use como referência de ritmo, não como promessa de data.
      </p>
    </div>
  );
}
