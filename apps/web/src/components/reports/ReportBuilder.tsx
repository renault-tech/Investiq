"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { listPortfolios, type Portfolio } from "@/lib/portfolio-api";
import { useQuery } from "@tanstack/react-query";

type Format = "pdf" | "xlsx";

interface ReportBuilderProps {
  month: string;
  onDownload: (params: { month: string; format: Format; accountIds: string[]; portfolioIds: string[] }) => void;
}

/** Lista de checkboxes com um "todas" que representa a ausência de seleção —
 * nenhuma marcada significa consolidado, que é o padrão do backend. */
function PickerGroup({
  title,
  emptyLabel,
  items,
  selected,
  onToggle,
  onClear,
}: {
  title: string;
  emptyLabel: string;
  items: { id: string; label: string; sub?: string | null }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const all = selected.length === 0;
  return (
    <div>
      <div className="text-[11.5px] font-medium text-[var(--text-secondary)] mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-[11.5px] text-[var(--text-muted)]">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onClear}
            aria-pressed={all}
            className="px-3 py-1.5 rounded-[9px] text-[11.5px] border transition-colors"
            style={{
              borderColor: all ? "var(--accent)" : "var(--border)",
              background: all ? "var(--glow)" : "var(--surface-2)",
              color: all ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            Todas (consolidado)
          </button>
          {items.map((item) => {
            const active = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                aria-pressed={active}
                className="px-3 py-1.5 rounded-[9px] text-[11.5px] border transition-colors"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--glow)" : "var(--surface-2)",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {item.label}
                {item.sub && <span className="text-[var(--text-muted)]"> · {item.sub}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ReportBuilder({ month, onDownload }: ReportBuilderProps) {
  const [format, setFormat] = useState<Format>("pdf");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [portfolioIds, setPortfolioIds] = useState<string[]>([]);

  const { data: accounts = [] } = useAccounts();
  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: listPortfolios,
    staleTime: 30_000,
  });

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div data-tour="report-builder" className="border-t border-[var(--border)] mt-6 pt-5 flex flex-col gap-4">
      <div>
        <div className="text-[11.5px] font-medium text-[var(--text-secondary)] mb-2">Formato</div>
        <div className="flex gap-1.5">
          {([
            ["pdf", "PDF", FileText],
            ["xlsx", "Excel", FileSpreadsheet],
          ] as const).map(([value, label, Icon]) => {
            const active = format === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFormat(value)}
                aria-pressed={active}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[9px] text-[11.5px] border transition-colors"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--glow)" : "var(--surface-2)",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                <Icon size={13} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      <PickerGroup
        title="Carteiras de finanças"
        emptyLabel="Nenhuma conta cadastrada — o relatório sai consolidado."
        items={accounts.map((a) => ({ id: a.id, label: a.name, sub: a.holder }))}
        selected={accountIds}
        onToggle={toggle(setAccountIds)}
        onClear={() => setAccountIds([])}
      />

      <PickerGroup
        title="Carteiras de investimentos"
        emptyLabel="Nenhuma carteira cadastrada."
        items={portfolios.map((p) => ({ id: p.id, label: p.name }))}
        selected={portfolioIds}
        onToggle={toggle(setPortfolioIds)}
        onClear={() => setPortfolioIds([])}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={() => onDownload({ month, format, accountIds, portfolioIds })}
          className="flex items-center gap-1.5 px-4 h-[38px] rounded-xl text-[12.5px] font-semibold"
          style={{ background: "var(--accent)", color: "#04120D" }}
        >
          <Download size={14} /> Gerar relatório
        </button>
        <span className="text-[11.5px] text-[var(--text-muted)]">
          {accountIds.length === 0
            ? "Finanças consolidadas de todas as carteiras"
            : `${accountIds.length} carteira(s) de finanças, uma seção para cada`}
        </span>
      </div>
    </div>
  );
}
