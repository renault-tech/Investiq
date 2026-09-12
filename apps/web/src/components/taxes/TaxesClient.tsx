"use client";

import { useState } from "react";
import { AlertTriangle, FileWarning, Receipt } from "lucide-react";
import { useTaxApuration, useDarfList, useInformeRendimentos } from "@/hooks/useTaxes";
import { formatBRLExact, assetTypeLabel } from "@/components/charts/chartTheme";
import { formatQuantity } from "@/lib/number-format";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMask } from "@/hooks/useMask";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function TaxesClient() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const mask = useMask();
  const { data: apuration, isLoading: apurationLoading } = useTaxApuration(year);
  const { data: darf, isLoading: darfLoading } = useDarfList(year);
  const { data: informe, isLoading: informeLoading } = useInformeRendimentos(year);

  return (
    <div className="p-[26px_30px_60px] flex flex-col gap-[18px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Impostos & IR</h2>
        <div className="flex rounded-[11px] border border-[var(--border)] overflow-hidden">
          {YEAR_OPTS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className="px-3 py-1.5 text-xs transition-colors"
              style={{
                background: year === y ? "var(--surface-3)" : "transparent",
                color: year === y ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5 border border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] rounded-[var(--radius-card-sm)] p-4">
        <AlertTriangle size={16} className="text-[var(--warning)] flex-shrink-0 mt-0.5" />
        <p className="text-[12px] leading-[1.55] text-[var(--text-secondary)]">
          {apuration?.disclaimer ??
            "Cálculo cobre apenas ações brasileiras e FIIs em operações comuns (swing trade). Day trade, ativos no exterior, cripto, ETFs e renda fixa ficam de fora. Não substitui a orientação de um contador."}
        </p>
      </div>

      {/* Prejuízo a compensar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)]">
          <div className="text-[11.5px] text-[var(--text-secondary)]">Prejuízo a compensar — Ações BR</div>
          <div className="text-[22px] font-semibold mt-1 tracking-[-.03em] text-[var(--text-primary)]">
            {apuration ? mask(formatBRLExact(apuration.loss_carry_forward_stock_br)) : "—"}
          </div>
        </div>
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow)]">
          <div className="text-[11.5px] text-[var(--text-secondary)]">Prejuízo a compensar — FIIs</div>
          <div className="text-[22px] font-semibold mt-1 tracking-[-.03em] text-[var(--text-primary)]">
            {apuration ? mask(formatBRLExact(apuration.loss_carry_forward_fii)) : "—"}
          </div>
        </div>
      </div>

      {/* Apuração mensal */}
      <section className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)]">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">Apuração mensal</div>
        <div className="text-[11.5px] text-[var(--text-secondary)] mb-4">
          Resultado realizado em vendas, mês a mês, custo médio ponderado
        </div>
        {apurationLoading ? (
          <div className="h-40 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        ) : !apuration || apuration.months.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhuma venda de ações ou FIIs neste ano." description="A apuração aparece aqui assim que houver uma venda registrada em Investimentos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["Mês", "Classe", "Vendido", "Resultado", "Isento", "Base tributável", "Imposto"].map((h) => (
                    <th key={h} className="px-2.5 py-2.5 text-[11px] font-medium text-[var(--text-muted)] tracking-[.06em] uppercase whitespace-nowrap text-right first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apuration.months.map((r) => {
                  const resultColor = r.gross_result >= 0 ? "var(--accent)" : "var(--danger)";
                  return (
                    <tr key={`${r.month}-${r.asset_class}`} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                      <td className="px-2.5 py-2.5 text-left text-[var(--text-primary)] whitespace-nowrap">{monthLabel(r.month)}</td>
                      <td className="px-2.5 py-2.5 text-right text-[var(--text-secondary)]">{assetTypeLabel(r.asset_class)}</td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{mask(formatBRLExact(r.total_sales))}</td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums font-medium" style={{ color: resultColor }}>{mask(formatBRLExact(r.gross_result))}</td>
                      <td className="px-2.5 py-2.5 text-right">
                        {r.exempt && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "var(--glow)", color: "var(--accent)" }}>
                            isento
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{mask(formatBRLExact(r.taxable_base))}</td>
                      <td className="px-2.5 py-2.5 text-right tabular-nums font-semibold text-[var(--text-primary)]">{mask(formatBRLExact(r.tax_due))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* DARF */}
      <section data-tour="tax-darf" className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)]">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">DARF do ano</div>
        <div className="text-[11.5px] text-[var(--text-secondary)] mb-4">
          Meses com imposto a pagar — confirme o vencimento e o código no e-CAC antes de pagar
        </div>
        {darfLoading ? (
          <div className="h-24 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        ) : !darf || darf.items.length === 0 ? (
          <EmptyState icon={FileWarning} title="Nenhum DARF devido neste ano." description="Ou tudo caiu na isenção de R$20 mil/mês, ou não houve ganho tributável." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {darf.items.map((item) => (
              <li key={`${item.month}-${item.asset_class}`} className="flex items-center gap-3 p-3.5 rounded-[12px] border border-[var(--border)]">
                <div className="w-9 h-9 rounded-[10px] bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
                  <Receipt size={16} className="text-[var(--text-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-[var(--text-primary)]">
                    {monthLabel(item.month)} · {assetTypeLabel(item.asset_class)} · código {item.codigo_receita}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    vencimento (aprox.) {new Date(`${item.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <span className="text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">{mask(formatBRLExact(item.valor))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Informe de rendimentos */}
      <section data-tour="tax-informe" className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow)]">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">Informe de rendimentos</div>
        <div className="text-[11.5px] text-[var(--text-secondary)] mb-4">
          {informe ? `Resumo para a declaração — posição em ${new Date(`${informe.snapshot_date}T12:00:00`).toLocaleDateString("pt-BR")}` : "Resumo para a declaração"}
        </div>
        {informeLoading || !informe ? (
          <div className="h-40 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div>
                <div className="text-[11px] text-[var(--text-secondary)]">Dividendos recebidos</div>
                <div className="text-[16px] font-semibold text-[var(--text-primary)] mt-0.5">{mask(formatBRLExact(informe.dividends_total))}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-secondary)]">Total vendido — Ações BR</div>
                <div className="text-[16px] font-semibold text-[var(--text-primary)] mt-0.5">{mask(formatBRLExact(informe.sales_stock_br_total))}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-secondary)]">Total vendido — FIIs</div>
                <div className="text-[16px] font-semibold text-[var(--text-primary)] mt-0.5">{mask(formatBRLExact(informe.sales_fii_total))}</div>
              </div>
            </div>

            {informe.positions_snapshot.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      {["Ativo", "Classe", "Qtd", "Custo total (bens e direitos)"].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-[11px] font-medium text-[var(--text-muted)] tracking-[.06em] uppercase whitespace-nowrap text-right first:text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {informe.positions_snapshot.map((p) => (
                      <tr key={p.ticker} className="border-b border-[var(--border)]">
                        <td className="px-2.5 py-2 text-left font-medium text-[var(--text-primary)]">{p.ticker}</td>
                        <td className="px-2.5 py-2 text-right text-[var(--text-secondary)]">{assetTypeLabel(p.asset_type)}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-[var(--text-secondary)]">{formatQuantity(p.quantity)}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-[var(--text-primary)]">{mask(formatBRLExact(p.total_cost))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {informe.dividends_by_asset.length > 0 && (
              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">Dividendos por ativo</div>
                <ul className="flex flex-col gap-1.5">
                  {informe.dividends_by_asset.slice(0, 8).map((d) => (
                    <li key={d.ticker} className="flex justify-between text-[12.5px]">
                      <span className="text-[var(--text-secondary)]">{d.ticker}</span>
                      <span className="tabular-nums text-[var(--text-primary)]">{mask(formatBRLExact(d.total))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
