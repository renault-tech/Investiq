"use client";

import { AlertTriangle, Copy, TrendingUp } from "lucide-react";
import { useInvoiceAnalytics } from "@/hooks/useCards";
import { formatBRL, formatBRLCompact } from "@/components/charts/chartTheme";
import { useMask } from "@/hooks/useMask";

interface InvoiceAnalyticsProps {
  invoiceId: string;
}

const FINDING_ICON = { duplicate: Copy, category_spike: TrendingUp, uncategorized: AlertTriangle };

function monthShort(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" });
}

/** Analytics pós-fatura: breakdown por categoria, tendência das últimas
 * faturas do mesmo cartão, maiores gastos e achados. Renderiza sob a
 * InvoiceReviewTable em CardsClient.tsx quando há uma fatura selecionada —
 * útil tanto em revisão quanto confirmada (o histórico de tendência
 * precisa de faturas passadas, que só existem depois de confirmadas). */
export function InvoiceAnalytics({ invoiceId }: InvoiceAnalyticsProps) {
  const { data, isLoading } = useInvoiceAnalytics(invoiceId);
  const mask = useMask();

  if (isLoading || !data) {
    return <div className="h-[220px] rounded-[var(--radius-card-sm)] bg-[var(--surface-2)] animate-pulse" />;
  }

  const maxCat = Math.max(1, ...data.category_breakdown.map((c) => c.amount));
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.total_amount));

  return (
    <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(12,1fr)" }}>
      <section className="col-span-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Gastos por categoria</h4>
        <div className="flex flex-col gap-3">
          {data.category_breakdown.map((c) => (
            <div key={c.category_id ?? "none"}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="text-[var(--text-secondary)]">{c.category}</span>
                <span className="flex items-baseline gap-2">
                  <b className="font-mono text-[var(--text-primary)]">{mask(formatBRL(c.amount))}</b>
                  {c.delta_pct !== null && (
                    <span className={`font-mono text-[10.5px] ${c.delta_pct > 15 ? "text-[var(--danger)]" : c.delta_pct < -15 ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                      {c.delta_pct > 0 ? "+" : ""}{c.delta_pct.toFixed(0)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--surface-3)] mt-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="col-span-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Fatura mês a mês</h4>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">média {mask(formatBRLCompact(data.avg_amount))}</span>
        </div>
        <div className="flex items-end gap-2 h-[100px]">
          {data.trend.map((t, i) => (
            <div key={t.reference_month} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-[76px] flex items-end">
                <div
                  className="w-full rounded-t-[5px]"
                  style={{
                    height: `${(t.total_amount / maxTrend) * 100}%`,
                    background: i === data.trend.length - 1 ? "var(--accent)" : "var(--surface-3)",
                  }}
                />
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">{monthShort(t.reference_month)}</span>
            </div>
          ))}
        </div>
      </section>

      {data.findings.length > 0 && (
        <section className="col-span-12 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card-sm)] overflow-hidden">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] p-5 pb-3">O que a leitura encontrou</h4>
          {data.findings.map((f, i) => {
            const Icon = FINDING_ICON[f.kind];
            return (
              <div key={i} className="flex items-start gap-3 px-5 py-3 border-t border-[var(--border)]">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--surface-3)] flex items-center justify-center text-[var(--warning)] flex-shrink-0">
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">{f.title}</span>
                    {f.amount !== null && <span className="font-mono text-[11px] text-[var(--text-secondary)]">{mask(formatBRL(f.amount))}</span>}
                  </div>
                  <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">{f.description}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

// Integração em CardsClient.tsx: importar InvoiceAnalytics e renderizar
// abaixo de <InvoiceReviewTable ... /> (mesmo bloco condicional):
//
//   {invoiceDetail && activeInvoiceId && (
//     <>
//       <InvoiceReviewTable ... />
//       <InvoiceAnalytics invoiceId={invoiceDetail.id} />
//     </>
//   )}
