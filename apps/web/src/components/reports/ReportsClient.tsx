"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Receipt, TrendingUp, Landmark, Trash2 } from "lucide-react";
import { ExportReportModal } from "./ExportReportModal";
import { listPortfolios, type Portfolio } from "@/lib/portfolio-api";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { usePortfolioIncome } from "@/hooks/usePortfolioIncome";
import { useFinanceSummary } from "@/hooks/useFinance";
import { useGeneratedReports, useQuickGenerateReport, useDownloadGeneratedReport, useDeleteGeneratedReport } from "@/hooks/useGeneratedReports";
import { REPORT_TYPE_LABELS, type GeneratedReport } from "@/lib/generated-reports-api";
import { apiClient } from "@/lib/api-client";
import { formatBRLCompact } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMask } from "@/hooks/useMask";
import { formatPercent } from "@/lib/number-format";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthShort(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short" });
}

async function downloadBlob(url: string, filename: string, params?: Record<string, string>) {
  const res = await apiClient.get(url, { params, responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(blobUrl);
}

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function reportDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ReportsClient() {
  const [showExport, setShowExport] = useState(false);
  const mask = useMask();
  const month = currentMonth();
  const year = new Date().getFullYear();

  const { data: portfolios = [] } = useQuery<Portfolio[]>({ queryKey: ["portfolios"], queryFn: listPortfolios, staleTime: 30_000 });
  const portfolioId = portfolios.find((p) => p.is_default)?.id ?? portfolios[0]?.id ?? null;
  const { data: summary } = usePortfolioSummary(portfolioId);
  const { data: income } = usePortfolioIncome(portfolioId, year);
  const { data: finSummary } = useFinanceSummary(month);

  const { data: generatedReports = [], isLoading: generatedLoading } = useGeneratedReports();
  const quickGenerate = useQuickGenerateReport();
  const downloadGenerated = useDownloadGeneratedReport();
  const deleteGenerated = useDeleteGeneratedReport();
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const QUICK_ACTIONS = [
    {
      type: "monthly-summary" as const,
      label: "Resumo mensal",
      description: "Finanças e investimentos do mês em PDF",
      icon: FileText,
      run: () => quickGenerate.mutate({ type: "monthly-summary", params: { month, format: "pdf" }, fileName: `resumo-mensal-${month}.pdf` }),
    },
    {
      type: "consolidated-statement" as const,
      label: "Extrato consolidado",
      description: "Todos os lançamentos financeiros em CSV",
      icon: Receipt,
      run: () => quickGenerate.mutate({ type: "consolidated-statement", params: {}, fileName: "extrato-consolidado.csv" }),
    },
    {
      type: "benchmark-performance" as const,
      label: "Rentabilidade vs benchmarks",
      description: "Carteira vs CDI, Ibovespa, Nasdaq e S&P 500",
      icon: TrendingUp,
      run: () => quickGenerate.mutate({ type: "benchmark-performance", params: { period: "1y" }, fileName: "rentabilidade-vs-benchmarks.csv" }),
    },
    {
      type: "tax-report" as const,
      label: "Relatório fiscal",
      description: "Apuração, DARF e informe de rendimentos",
      icon: Landmark,
      run: () => quickGenerate.mutate({ type: "tax-report", params: { year }, fileName: `relatorio-fiscal-${year}.csv` }),
    },
  ];

  const comparativo = (finSummary?.monthly_series ?? []).slice(-12);
  const compMax = Math.max(1, ...comparativo.flatMap((m) => [Number(m.income), Number(m.expense)]));

  // Decimal do backend chega como string no JSON — sem Number(), .toFixed
  // estoura e derruba a página inteira.
  const pnlPercent = Number(summary?.total_pnl_percent ?? 0);
  const investedTotal = Number(summary?.total_invested_brl ?? 0);
  const financeNet = Number(finSummary?.net ?? 0);
  const incomeTotal = Number(income?.total ?? 0);

  const metrics = [
    {
      label: "Variação patrimonial",
      value: formatPercent(pnlPercent, 1, { signed: true }),
      color: pnlPercent >= 0 ? "var(--accent)" : "var(--danger)",
    },
    { label: "Total investido", value: mask(formatBRLCompact(investedTotal)), color: "var(--text-primary)" },
    { label: "Sobra do mês", value: mask(formatBRLCompact(financeNet)), color: "var(--text-primary)" },
    { label: `Proventos em ${year}`, value: mask(formatBRLCompact(incomeTotal)), color: "var(--accent)" },
  ];

  return (
    <div className="p-[26px_30px_60px] flex flex-col gap-[18px]">
      <section
        className="rounded-[var(--radius-card)] p-[26px] shadow-[var(--shadow)] animate-rise-up"
        style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))" }}
      >
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="text-lg font-semibold tracking-[-.03em] text-[var(--text-primary)]">Relatório consolidado · {year}</div>
            <div className="text-[12.5px] text-[var(--text-secondary)] mt-1">Patrimônio, fluxo de caixa e proventos em um único documento.</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => downloadBlob("/finance/transactions/export", `transacoes-${month}.csv`)}
              className="px-4 h-[38px] rounded-xl border border-[var(--border-strong)] text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              CSV
            </button>
            <button
              data-tour="report-builder"
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-4 h-[38px] rounded-xl text-[12.5px] font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              <Download size={14} /> Exportar relatório
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-[18px] mt-6">
          {metrics.map((m) => (
            <div key={m.label} className="border-l border-[var(--border)] pl-4">
              <div className="text-[11.5px] text-[var(--text-secondary)]">{m.label}</div>
              <div className="text-2xl font-semibold mt-1.5 tabular-nums" style={{ color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="responsive-grid-12 grid gap-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
        <section
          className="col-span-7 rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up"
          style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))", animationDelay: ".08s" }}
        >
          <div className="text-sm font-semibold text-[var(--text-primary)]">Comparativo mensal</div>
          <div className="flex items-end gap-3 h-[190px] mt-5.5">
            {comparativo.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full h-[158px] flex items-end gap-[3px]">
                  <div className="flex-1 rounded-t-[5px] rounded-b-[2px] animate-grow-y" style={{ height: `${(Number(m.income) / compMax) * 100}%`, background: "var(--accent)" }} />
                  <div className="flex-1 rounded-t-[5px] rounded-b-[2px] animate-grow-y" style={{ height: `${(Number(m.expense) / compMax) * 100}%`, background: "var(--surface-3)", animationDelay: ".08s" }} />
                </div>
                <span className="text-[10.5px] text-[var(--text-muted)]">{monthShort(m.month)}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="col-span-5 rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up"
          style={{ border: "1px solid var(--border)", background: "linear-gradient(180deg,var(--t4),var(--t1))", animationDelay: ".14s" }}
        >
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">Ações rápidas</div>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.type}
                onClick={action.run}
                disabled={quickGenerate.isPending}
                className="text-left p-3.5 rounded-[12px] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-60"
              >
                <action.icon size={16} style={{ color: "var(--accent)" }} />
                <div className="text-[12px] font-medium text-[var(--text-primary)] mt-2">{action.label}</div>
                <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">{action.description}</div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">Relatórios gerados</div>
        <div className="text-[11.5px] text-[var(--text-secondary)] mb-4">
          Histórico do que você já gerou — baixar de novo não recalcula nada
        </div>
        {generatedLoading ? (
          <div className="h-24 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        ) : generatedReports.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum relatório gerado ainda." description="Use uma das ações rápidas acima ou exporte um relatório personalizado." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {generatedReports.map((report: GeneratedReport) => (
              <li key={report.id} className="flex items-center gap-3 py-3">
                <div className="w-[34px] h-[34px] rounded-[11px] bg-[var(--surface-3)] flex items-center justify-center text-[var(--text-secondary)] flex-shrink-0">
                  <FileText size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">
                    {REPORT_TYPE_LABELS[report.report_type]}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {report.format.toUpperCase()} · {fileSizeLabel(report.file_size)} · {reportDateLabel(report.created_at)}
                  </div>
                </div>
                {confirmingDeleteId === report.id ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setConfirmingDeleteId(null)} className="text-[11.5px] text-[var(--text-secondary)]">Cancelar</button>
                    <button
                      onClick={() => deleteGenerated.mutate(report.id, { onSuccess: () => setConfirmingDeleteId(null) })}
                      className="text-[11.5px] font-medium text-[var(--danger)]"
                    >
                      Excluir
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => downloadGenerated.mutate(report)}
                      className="text-[11.5px] font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      Baixar
                    </button>
                    <button
                      onClick={() => setConfirmingDeleteId(report.id)}
                      aria-label={`Excluir ${REPORT_TYPE_LABELS[report.report_type]}`}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {showExport && (
        <ExportReportModal month={month} origin="reports" onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
