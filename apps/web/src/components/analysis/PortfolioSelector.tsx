"use client";

import { useQuery } from "@tanstack/react-query";
import { listPortfolios } from "@/lib/portfolio-api";

interface PortfolioSelectorProps {
  activeId: string | null;
  onChange: (id: string) => void;
}

export function PortfolioSelector({ activeId, onChange }: PortfolioSelectorProps) {
  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ["portfolios"],
    queryFn: listPortfolios,
  });

  return (
    <div className="mb-6">
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wide">
        Portfólio para Análise
      </label>
      <select
        value={activeId || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || portfolios.length === 0}
        className="block w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--navy)] disabled:opacity-50 appearance-none"
      >
        <option value="" disabled>
          {isLoading ? "Carregando..." : "Selecione um portfólio"}
        </option>
        {portfolios.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
