"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { ExportReportModal } from "./ExportReportModal";
import { listPortfolios, type Portfolio } from "@/lib/portfolio-api";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { usePortfolioIncome } from "@/hooks/usePortfolioIncome";
import { useFinanceSummary } from "@/hooks/useFinance";
import { apiClient } from "@/lib/api-client";
import { formatBRLCompact } from "@/components/charts/chartTheme";
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

  const comparativo = (finSummary?.monthly_series ?? []).slice(-12);
  const compMax = Math.max(1, ...comparativo.flatMap((m) => [Number(m.income), Number(m.expense)]));

  const recentMonths = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

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
      <section className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-[26px] shadow-[var(--shadow)] animate-rise-up">
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
              style={{ background: "var(--accent)", color: "#04120D" }}
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
        <section className="col-span-7 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".08s" }}>
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

        <section className="col-span-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)] animate-rise-up" style={{ animationDelay: ".14s" }}>
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">Documentos disponíveis</div>
          {recentMonths.map((m) => (
            <div key={m} className="flex items-center gap-3 py-3 border-b border-[var(--border)]">
              <div className="w-[34px] h-[34px] rounded-[11px] bg-[var(--surface-3)] flex items-center justify-center text-[var(--text-secondary)]">
                <FileText size={15} />
              </div>
              <div className="flex-1">
                <div className="text-[12.5px] font-medium capitalize text-[var(--text-primary)]">
                  Relatório mensal · {new Date(`${m}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">PDF · gerado na hora</div>
              </div>
              <button
                onClick={() => downloadBlob("/reports/monthly", `relatorio-${m}.pdf`, { month: m })}
                className="text-[11.5px] font-medium"
                style={{ color: "var(--accent)" }}
              >
                Baixar
              </button>
            </div>
          ))}
        </section>
      </div>

      {showExport && (
        <ExportReportModal month={month} origin="reports" onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
