"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle } from "lucide-react";
import { useForecast } from "@/hooks/useForecast";
import { useAccounts } from "@/hooks/useAccounts";
import { useFinanceScopeStore } from "@/store/useFinanceScopeStore";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/ui/Input";

const ForecastChart = dynamic(
  () => import("./ForecastChart").then((m) => m.ForecastChart),
  { ssr: false, loading: () => <Skeleton className="absolute inset-0 h-full" /> }
);

const HORIZONS = [3, 6, 12] as const;

function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  // "agosto de 2026" — a classe `capitalize` do CSS maiuscularia cada
  // palavra ("Agosto De 2026"); em português só a inicial é maiúscula.
  const label = new Date(year, mon - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ForecastSection() {
  const [months, setMonths] = useState<(typeof HORIZONS)[number]>(6);
  // Compartilhada com AccountsBar (tela /finances) — escolher a conta aqui
  // ou lá é a mesma "carteira ativa", não dois filtros desencontrados.
  const accountId = useFinanceScopeStore((s) => s.activeAccountId);
  const setAccountId = useFinanceScopeStore((s) => s.setActiveAccountId);
  const { data: accounts = [] } = useAccounts();
  const { data: forecast, isLoading, isError, refetch } = useForecast(months, accountId);

  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Projeção de fluxo de caixa</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Cor forte é o que já é conhecido (recorrência, parcela, fatura em aberto); cor clara é
            estimativa pela mediana dos últimos 6 meses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <Select
              value={accountId ?? ""}
              onChange={(e) => setAccountId(e.target.value || null)}
              aria-label="Escopo da projeção"
              className="!py-1.5 text-xs"
            >
              <option value="">Todas as contas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.holder ? ` · ${a.holder}` : ""}
                </option>
              ))}
            </Select>
          )}
          <div className="flex rounded-[9px] border border-[var(--border)] overflow-hidden">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setMonths(h)}
                className="px-2 py-1 text-xs transition-colors"
                style={{
                  background: months === h ? "var(--surface-3)" : "transparent",
                  color: months === h ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {h}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {forecast?.negative_from && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 text-xs rounded-[9px] bg-[var(--danger)]/10 text-[var(--danger)]">
          <AlertTriangle size={14} className="shrink-0" />
          Na projeção realista, o saldo fica negativo a partir de{" "}
          <span className="font-medium">{monthLabel(forecast.negative_from)}</span>.
        </div>
      )}

      <div style={{ height: 320 }} className="relative">
        {isLoading ? (
          <Skeleton className="absolute inset-0 h-full" />
        ) : isError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ErrorState title="Não foi possível carregar a projeção." onRetry={refetch} />
          </div>
        ) : !forecast || forecast.months.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState icon={AlertTriangle} title="Sem dados suficientes para projetar." />
          </div>
        ) : (
          <ForecastChart months={forecast.months} negativeFrom={forecast.negative_from} />
        )}
      </div>
    </div>
  );
}
