"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { usePortfolioAudit, useRepairPortfolioFx } from "@/hooks/usePortfolioAudit";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { formatQuantity, formatDecimal } from "@/lib/number-format";
import { Button } from "@/components/ui/Button";

/** "De onde saiu esse número?" — a conta aberta de cada posição.
 *
 * Um total errado não diz onde nasceu, e conferir posição a posição na mão
 * exige refazer a mesma multiplicação que o sistema já fez. Aqui cada linha
 * mostra os três fatores (quantidade × preço na moeda do ativo × câmbio) e o
 * resultado, então dá pra achar de olho a que está fora de escala — que é
 * quase sempre uma quantidade digitada com separador errado ou um custo
 * gravado sem conversão de moeda.
 */
export function AuditPanel({ portfolioId }: { portfolioId: string | null }) {
  const [open, setOpen] = useState(false);
  // Busca sempre que há uma carteira, não só quando o painel está aberto —
  // do contrário o selo de aviso no cabeçalho fechado nunca aparece, porque
  // o dado que ele mostra só existiria depois de abrir o próprio painel que
  // o selo deveria anunciar.
  const { data: audit, isLoading } = usePortfolioAudit(portfolioId);
  const repair = useRepairPortfolioFx(portfolioId);

  const issueCount = audit?.issue_count ?? 0;

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-card)] shadow-[var(--shadow)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-[22px] py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown size={15} className="text-[var(--text-muted)]" /> : <ChevronRight size={15} className="text-[var(--text-muted)]" />}
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
            Conferir os números
          </span>
          <span className="text-[11.5px] text-[var(--text-muted)]">
            quantidade × preço × câmbio, posição por posição
          </span>
        </span>
        {issueCount > 0 && (
          <span
            className="flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 border"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            <AlertTriangle size={11} /> {issueCount}
          </span>
        )}
      </button>

      {open && (
        <div className="px-[22px] pb-5">
          {isLoading || !audit ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 rounded-md bg-[var(--surface-2)] animate-pulse" />
              ))}
            </div>
          ) : audit.positions.length === 0 ? (
            <p className="text-[12px] text-[var(--text-muted)]">Nenhuma posição nesta carteira.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[11px] text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="px-2 py-2 font-medium">Ativo</th>
                      <th className="px-2 py-2 font-medium text-right">Quantidade</th>
                      <th className="px-2 py-2 font-medium text-right">Preço</th>
                      <th className="px-2 py-2 font-medium text-right">Câmbio</th>
                      <th className="px-2 py-2 font-medium text-right">Valor de mercado</th>
                      <th className="px-2 py-2 font-medium text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.positions.map((pos) => (
                      <tr
                        key={pos.position_id}
                        className="border-b border-[var(--border)] last:border-0 align-top"
                      >
                        <td className="px-2 py-2">
                          <span className="text-[var(--text-primary)] font-medium">{pos.ticker}</span>
                          <span className="ml-1.5 text-[10.5px] text-[var(--text-muted)]">{pos.currency}</span>
                          {pos.issues.map((issue) => (
                            <p
                              key={issue.code}
                              className="mt-1 text-[10.5px] leading-snug max-w-[380px]"
                              style={{ color: "var(--danger)" }}
                            >
                              {issue.message}
                            </p>
                          ))}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                          {formatQuantity(pos.quantity)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                          {formatDecimal(pos.price_native)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                          {formatDecimal(pos.fx_rate, 4)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-primary)]">
                          {formatBRLExact(pos.market_value_brl)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                          {formatBRLExact(pos.cost_basis_brl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border-strong)]">
                      <td className="px-2 py-2 text-[var(--text-secondary)]" colSpan={4}>
                        Total
                      </td>
                      <td className="px-2 py-2 text-right font-mono font-semibold text-[var(--text-primary)]">
                        {formatBRLExact(audit.total_market_value_brl)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[var(--text-secondary)]">
                        {formatBRLExact(audit.total_cost_basis_brl)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                {issueCount > 0 ? (
                  <p className="text-[11.5px] text-[var(--text-secondary)] max-w-[520px] leading-snug">
                    Transações de ativo estrangeiro lançadas com câmbio 1 guardam o custo em
                    moeda estrangeira num campo lido como reais. Corrigir regrava cada uma com
                    o câmbio do dia em que ela aconteceu, recalcula a posição e limpa o
                    histórico do gráfico de performance.
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)] max-w-[520px] leading-snug">
                    <CheckCircle2 size={13} style={{ color: "var(--accent)" }} />
                    Nenhuma inconsistência de moeda encontrada. Se o gráfico de performance
                    ainda mostrar um valor que não bate, ele pode ter guardado um número de um
                    dia em que a posição esteve errada — corrigir aqui também limpa esse histórico.
                  </p>
                )}
                <Button
                  size="sm"
                  variant={issueCount > 0 ? "primary" : "secondary"}
                  loading={repair.isPending}
                  onClick={() => repair.mutate()}
                >
                  <Wrench size={13} /> {issueCount > 0 ? "Corrigir câmbio" : "Recalcular gráfico"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
