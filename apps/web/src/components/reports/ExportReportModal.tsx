"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAccounts } from "@/hooks/useAccounts";
import { listPortfolios, type Portfolio } from "@/lib/portfolio-api";
import {
  DEFAULT_REPORT_OPTIONS,
  downloadReport,
  isValidSelection,
  monthLabel,
  recentMonths,
  reportFileName,
  type ReportFormat,
  type ReportOptions,
} from "@/lib/report-export";

interface ExportReportModalProps {
  onClose: () => void;
  /** Mês inicial (YYYY-MM). */
  month: string;
  /** De onde o modal foi aberto — define o que já vem marcado. Exportar da
   * tela de Finanças com investimentos ligados por padrão obrigaria a
   * desmarcar toda vez. */
  origin?: "reports" | "finances" | "investments";
  /** Carteira de investimentos em foco na tela de origem. */
  defaultPortfolioIds?: string[];
}

const chipBase =
  "px-3 py-1.5 rounded-[9px] text-[11.5px] border transition-colors text-left";

function chipStyle(active: boolean) {
  return {
    borderColor: active ? "var(--accent)" : "var(--border)",
    background: active ? "var(--glow)" : "var(--surface-2)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] font-medium text-[var(--text-secondary)]">{title}</div>
      {hint && <p className="text-[10.5px] text-[var(--text-muted)] mt-0.5 mb-1.5">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-[var(--border)] accent-[var(--accent)]"
      />
      <span>
        <span className="block text-[12.5px] text-[var(--text-primary)]">{label}</span>
        {hint && <span className="block text-[10.5px] text-[var(--text-muted)]">{hint}</span>}
      </span>
    </label>
  );
}

function PickerGroup({
  emptyLabel,
  items,
  selected,
  onToggle,
  onClear,
  allLabel,
}: {
  emptyLabel: string;
  items: { id: string; label: string; sub?: string | null }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  allLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-[11.5px] text-[var(--text-muted)]">{emptyLabel}</p>;
  }
  const all = selected.length === 0;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={onClear} aria-pressed={all} className={chipBase} style={chipStyle(all)}>
        {allLabel}
      </button>
      {items.map((item) => {
        const active = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            aria-pressed={active}
            className={chipBase}
            style={chipStyle(active)}
          >
            {item.label}
            {item.sub && <span className="text-[var(--text-muted)]"> · {item.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ExportReportModal({
  onClose,
  month: initialMonth,
  origin = "reports",
  defaultPortfolioIds = [],
}: ExportReportModalProps) {
  const [options, setOptions] = useState<ReportOptions>({
    ...DEFAULT_REPORT_OPTIONS,
    month: initialMonth,
    portfolioIds: defaultPortfolioIds,
    // Exportando de Finanças, investimentos começa desmarcado: a carteira
    // pode ser de outra pessoa e quem está nessa tela quer o fluxo de caixa.
    includeInvestments: origin !== "finances",
    includeFinance: origin !== "investments",
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data: accounts = [] } = useAccounts();
  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["portfolios"],
    queryFn: listPortfolios,
    staleTime: 30_000,
  });

  const months = useMemo(() => recentMonths(12), []);
  const set = <K extends keyof ReportOptions>(key: K, value: ReportOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const toggleIn = (key: "accountIds" | "portfolioIds") => (id: string) =>
    setOptions((prev) => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter((x) => x !== id) : [...prev[key], id],
    }));

  const valid = isValidSelection(options);

  // Prévia textual do documento: o usuário confere o que vai sair antes de
  // gerar, em vez de baixar, abrir e descobrir que faltou uma seção.
  const preview = useMemo(() => {
    const lines: string[] = [];
    if (options.includeFinance) {
      const scope =
        options.accountIds.length === 0
          ? "todas as carteiras (consolidado)"
          : `${options.accountIds.length} carteira(s), uma seção para cada`;
      lines.push(`Finanças — ${scope}`);
      if (options.includeCharts) {
        lines.push("· Receitas x despesas (12 meses), saldo mensal e despesas por categoria");
      }
      lines.push("· Tabela de despesas por categoria");
    }
    if (options.includeInvestments) {
      const scope =
        options.portfolioIds.length === 0
          ? "todas as carteiras"
          : `${options.portfolioIds.length} carteira(s)`;
      lines.push(`Investimentos — ${scope}`);
      if (options.includeCharts) lines.push("· Alocação por classe de ativo");
      lines.push("· Tabela de investido, valor atual e P&L");
    }
    return lines;
  }, [options]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadReport(options);
      toast.success("Relatório gerado!");
      onClose();
    } catch {
      toast.error("Não foi possível gerar o relatório. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      title="Exportar relatório"
      onClose={onClose}
      maxWidth="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!valid || isExporting} loading={isExporting}>
            {isExporting ? "Gerando…" : "Gerar relatório"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Section title="Período">
          <select
            value={options.month}
            onChange={(e) => set("month", e.target.value)}
            aria-label="Mês do relatório"
            className="w-full px-3 py-2 text-[12.5px] border border-[var(--border)] rounded-[11px] bg-[var(--surface-2)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Formato">
          <div className="flex gap-1.5">
            {(
              [
                ["pdf", "PDF", FileText],
                ["xlsx", "Excel", FileSpreadsheet],
              ] as const
            ).map(([value, label, Icon]) => {
              const active = options.format === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("format", value as ReportFormat)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 ${chipBase}`}
                  style={chipStyle(active)}
                >
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="O que incluir">
          <Toggle
            checked={options.includeFinance}
            onChange={(v) => set("includeFinance", v)}
            label="Finanças pessoais"
            hint="Receitas, despesas, saldo e categorias."
          />
          <Toggle
            checked={options.includeInvestments}
            onChange={(v) => set("includeInvestments", v)}
            label="Investimentos"
            hint="Desmarque se as carteiras cadastradas não são suas — a seção sai inteira do documento."
          />
          <Toggle
            checked={options.includeCharts}
            onChange={(v) => set("includeCharts", v)}
            label="Gráficos"
            hint="Evolução mensal, saldo e composição por categoria."
          />
          {!valid && (
            <p className="text-[11px] text-[var(--danger)] mt-1">
              Escolha ao menos uma seção para gerar o relatório.
            </p>
          )}
        </Section>

        {options.includeFinance && (
          <Section
            title="Carteiras de finanças"
            hint="Escolher mais de uma gera uma seção separada para cada, em vez de somar tudo."
          >
            <PickerGroup
              allLabel="Todas (consolidado)"
              emptyLabel="Nenhuma conta cadastrada — o relatório sai consolidado."
              items={accounts.map((a) => ({ id: a.id, label: a.name, sub: a.holder }))}
              selected={options.accountIds}
              onToggle={toggleIn("accountIds")}
              onClear={() => set("accountIds", [])}
            />
          </Section>
        )}

        {options.includeInvestments && (
          <Section title="Carteiras de investimentos">
            <PickerGroup
              allLabel="Todas"
              emptyLabel="Nenhuma carteira cadastrada."
              items={portfolios.map((p) => ({ id: p.id, label: p.name }))}
              selected={options.portfolioIds}
              onToggle={toggleIn("portfolioIds")}
              onClear={() => set("portfolioIds", [])}
            />
          </Section>
        )}

        <div className="border-t border-[var(--border)] pt-3">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--text-secondary)] mb-2">
            <BarChart3 size={13} /> Prévia do documento
          </div>
          {valid ? (
            <ul className="flex flex-col gap-1">
              {preview.map((line) => (
                <li
                  key={line}
                  className={`text-[11.5px] ${
                    line.startsWith("·")
                      ? "text-[var(--text-muted)] pl-3"
                      : "text-[var(--text-primary)] font-medium"
                  }`}
                >
                  {line}
                </li>
              ))}
              <li className="text-[10.5px] text-[var(--text-muted)] mt-1.5 font-mono">
                {reportFileName(options)}
              </li>
            </ul>
          ) : (
            <p className="text-[11.5px] text-[var(--text-muted)]">
              Nada selecionado — o documento sairia vazio.
            </p>
          )}
        </div>

        {isExporting && (
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Loader2 size={12} className="animate-spin" />
            Buscando cotações e montando o documento…
          </p>
        )}
      </div>
    </Modal>
  );
}
