"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock, FileWarning, Inbox, Tag } from "lucide-react";
import { useActionCenter } from "@/hooks/useActions";
import { formatBRLExact } from "@/components/charts/chartTheme";
import { useMask } from "@/hooks/useMask";
import { ActionKind } from "@/lib/actions-api";

const KIND_ICON: Record<ActionKind, typeof Clock> = {
  bill_overdue: AlertCircle,
  bill_due: Clock,
  invoice_review: FileWarning,
  invoice_uncategorized: Tag,
};
const KIND_COLOR: Record<ActionKind, string> = {
  bill_overdue: "var(--danger)",
  bill_due: "var(--warning)",
  invoice_review: "var(--accent-2)",
  invoice_uncategorized: "var(--text-muted)",
};

/** Central de Ações — inbox único de pendências, priorizado por urgência e
 * prazo (o backend já ordena; aqui só renderiza).
 *
 * Complementa o NotificationsDropdown, não repete: notificação é evento que
 * já aconteceu (alerta de preço disparou, orçamento estourou); isto é "o que
 * falta você fazer". Vencimento de conta vive só aqui — o worker que
 * mandava isso para o sino foi removido justamente para os dois ícones
 * vizinhos não anunciarem a mesma conta.
 *
 * Valores em formatBRLExact, não no compacto: aqui o número é o que decide
 * o que pagar primeiro, e "R$ 1 mil" no lugar de R$ 1.240,50 esconde
 * justamente a informação que o usuário veio buscar. */
export function ActionCenterDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, isError } = useActionCenter();
  const mask = useMask();

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const count = data?.items.length ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label={`Central de ações${count > 0 ? ` (${count} pendências)` : ""}`}
        aria-expanded={open}
      >
        <Inbox size={16} />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-[3px] rounded-full text-[9px] font-semibold flex items-center justify-center text-white"
            // Fundo escurecido a partir do próprio --danger, não o token puro:
            // branco sobre --danger dá 4,26:1 no claro e 2,79:1 no escuro, e
            // 9px não se qualifica como texto grande (mínimo 4,5:1). O
            // color-mix escurece qualquer que seja o valor do token, nos dois
            // temas, sem precisar de uma variável nova.
            style={{ background: "color-mix(in srgb, var(--danger) 72%, #000)" }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-[420px] flex flex-col">
          <div className="flex items-center justify-between gap-2 p-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Central de ações</h3>
            {data && data.total_amount > 0 && (
              <span className="text-xs font-mono text-[var(--danger)] shrink-0">
                {mask(formatBRLExact(data.total_amount))} pendente
              </span>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {isError ? (
              <p className="p-6 text-center text-sm text-[var(--text-muted)]">Não foi possível carregar.</p>
            ) : !data || data.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--text-muted)]">Tudo em dia — nenhuma pendência.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.items.map((item) => {
                  const Icon = KIND_ICON[item.kind] ?? Clock;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex gap-2.5 p-3 hover:bg-[var(--surface-2)] transition-colors"
                      >
                        <Icon size={15} className="mt-0.5 shrink-0" style={{ color: KIND_COLOR[item.kind] }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{item.title}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.description}</p>
                        </div>
                        {item.amount !== null && (
                          <span className="text-xs font-mono text-[var(--text-secondary)] shrink-0">
                            {mask(formatBRLExact(item.amount))}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
