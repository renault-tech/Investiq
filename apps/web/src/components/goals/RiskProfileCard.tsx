"use client";

import { ShieldCheck } from "lucide-react";
import { useSettings, usePatchSettings } from "@/hooks/useSettings";
import type { AllocationSlice } from "@/lib/portfolio-api";

const PROFILES = [
  { value: "conservador", label: "Conservador", riskPct: 20, blurb: "Prioriza estabilidade — a maior parte em renda fixa/caixa." },
  { value: "moderado", label: "Moderado", riskPct: 50, blurb: "Equilíbrio entre estabilidade e crescimento." },
  { value: "arrojado", label: "Arrojado", riskPct: 80, blurb: "Prioriza crescimento — tolera mais oscilação no curto prazo." },
] as const;

// Mesmo agrupamento usado em Visão Geral (RISK_ASSET_TYPES) pra separar
// ativos de risco de renda fixa/caixa — mantém os dois lugares consistentes
// sem depender de um enum novo no backend.
const RISK_ASSET_TYPES = new Set(["stock", "stock_br", "stock_us", "fii", "reit", "etf", "crypto", "commodity"]);

function realRiskPct(allocation: AllocationSlice[]): number | null {
  if (allocation.length === 0) return null;
  const total = allocation.reduce((s, a) => s + Number(a.value), 0);
  if (total <= 0) return null;
  const risk = allocation.filter((a) => RISK_ASSET_TYPES.has(a.asset_type)).reduce((s, a) => s + Number(a.value), 0);
  return (risk / total) * 100;
}

interface RiskProfileCardProps {
  allocation: AllocationSlice[];
}

/** Perfil de risco declarado (persistido em Configurações) comparado com a
 * alocação real da carteira consolidada. Os percentuais-alvo por perfil são
 * uma referência didática comum (não uma recomendação personalizada de um
 * profissional certificado) — dito explicitamente no rodapé do card. */
export function RiskProfileCard({ allocation }: RiskProfileCardProps) {
  const { data: settings } = useSettings();
  const patchMutation = usePatchSettings();
  const selected = PROFILES.find((p) => p.value === settings?.risk_profile) ?? null;
  const real = realRiskPct(allocation);

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={16} className="text-[var(--accent)]" />
        <div className="text-sm font-semibold text-[var(--text-primary)]">Seu perfil</div>
      </div>
      <div className="text-[11.5px] text-[var(--text-secondary)] mb-4">
        Escolha o perfil que melhor descreve sua tolerância a risco
      </div>

      <div className="flex gap-2 flex-wrap">
        {PROFILES.map((p) => (
          <button
            key={p.value}
            onClick={() => patchMutation.mutate({ risk_profile: p.value })}
            disabled={patchMutation.isPending}
            className="flex-1 min-w-[120px] px-3 py-2.5 rounded-[11px] text-left transition-colors disabled:opacity-60"
            style={{
              background: selected?.value === p.value ? "var(--glow)" : "var(--surface-2)",
              border: `1px solid ${selected?.value === p.value ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            <div className="text-[12.5px] font-semibold" style={{ color: selected?.value === p.value ? "var(--accent)" : "var(--text-primary)" }}>
              {p.label}
            </div>
            <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">{p.blurb}</div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-5 pt-4 border-t border-[var(--border)] space-y-3">
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Alvo do perfil — ativos de risco</span>
              <span className="tabular-nums">{selected.riskPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${selected.riskPct}%`, background: "var(--text-muted)" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
              <span>Sua carteira hoje — ativos de risco</span>
              <span className="tabular-nums">{real != null ? `${Math.round(real)}%` : "—"}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${real ?? 0}%`, background: "var(--accent)" }} />
            </div>
          </div>
          <p className="text-[10.5px] text-[var(--text-muted)] pt-1">
            Percentuais-alvo são uma referência educativa por perfil — não substituem orientação de um profissional certificado.
          </p>
        </div>
      )}
    </section>
  );
}
