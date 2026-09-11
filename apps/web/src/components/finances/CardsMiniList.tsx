"use client";

import Link from "next/link";
import { CreditCard as CardIcon } from "lucide-react";
import { useCards, useLatestInvoices } from "@/hooks/useCards";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMask } from "@/hooks/useMask";
import { CATEGORICAL } from "@/components/charts/chartTheme";

/** Mesma fonte de dados do card de cartões visuais (Lote 9,
 * `useLatestInvoices`) — aqui como lista compacta dentro de Finanças, uma
 * barra de limite por cartão, no lugar do agregado único que "Fatura
 * atual" já mostra na Visão Geral. */
export function CardsMiniList() {
  const { data: cards = [], isLoading } = useCards();
  const activeCards = cards.filter((c) => c.is_active);
  const latestInvoiceByCard = useLatestInvoices(activeCards.map((c) => c.id));
  const mask = useMask();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">Cartões</div>
        <Link href="/finances/cards" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Gerenciar</Link>
      </div>
      {isLoading ? (
        <div className="h-24 rounded bg-[var(--surface-3)] animate-pulse" />
      ) : activeCards.length === 0 ? (
        <EmptyState icon={CardIcon} title="Nenhum cartão cadastrado" />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {activeCards.slice(0, 3).map((c, i) => {
            const invoice = latestInvoiceByCard.get(c.id);
            const total = Number(invoice?.total_amount ?? 0);
            const limit = Number(c.credit_limit ?? 0);
            const pct = limit > 0 ? Math.min(100, (total / limit) * 100) : null;
            return (
              <li key={c.id}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-6 rounded-md border border-[var(--border-strong)] flex-shrink-0" style={{ background: `linear-gradient(135deg, ${CATEGORICAL[i % CATEGORICAL.length]}, var(--surface-3))` }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate text-[var(--text-primary)]">{c.name}</div>
                    <div className="text-[10.5px] text-[var(--text-muted)]">•••• {c.last4 ?? "----"}</div>
                  </div>
                  <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                    {invoice ? mask(formatBRLExact(total)) : "—"}
                  </span>
                </div>
                {pct !== null && (
                  <div className="h-[5px] rounded-full bg-[var(--surface-3)] overflow-hidden mt-2">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-2))" }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
