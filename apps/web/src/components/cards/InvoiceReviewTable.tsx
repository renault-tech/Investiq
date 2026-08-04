"use client";

import { Trash2 } from "lucide-react";
import { InvoiceDetail } from "@/lib/cards-api";
import { FinanceCategory } from "@/lib/finance-api";
import { useUpdateInvoiceItem } from "@/hooks/useCards";
import { formatBRL } from "@/components/charts/chartTheme";

interface InvoiceReviewTableProps {
  invoice: InvoiceDetail;
  categories: FinanceCategory[];
  onConfirm: () => void;
  onDelete: () => void;
  confirming: boolean;
}

export function InvoiceReviewTable({ invoice, categories, onConfirm, onDelete, confirming }: InvoiceReviewTableProps) {
  const updateItem = useUpdateInvoiceItem(invoice.id);
  const expenseCategories = categories.filter((c) => c.category_type === "expense" && c.is_active);
  const editable = invoice.status === "review";

  const activeItems = invoice.items.filter((i) => !i.is_ignored);
  const activeTotal = activeItems.reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Lançamentos extraídos
          {!editable && <span className="ml-2 text-xs text-[var(--text-muted)]">(fatura {invoice.status === "confirmed" ? "confirmada — somente leitura" : invoice.status})</span>}
        </h3>
        {editable && (
          <button onClick={onDelete} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)]" aria-label="Excluir fatura">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
              <th className="px-3 py-2 font-medium">Descrição</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Parcela</th>
              <th className="px-3 py-2 font-medium">Categoria</th>
              <th className="px-3 py-2 font-medium text-right">Valor</th>
              <th className="px-3 py-2 font-medium text-center">Ignorar</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-[var(--border)] ${item.is_ignored ? "opacity-40" : ""}`}
              >
                <td className="px-3 py-2 text-[var(--text-primary)] max-w-64 truncate" title={item.description}>
                  {item.description}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                  {item.purchase_date ? new Date(`${item.purchase_date}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">
                  {item.installment_no ? `${item.installment_no}/${item.installment_total ?? "?"}` : "—"}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={item.category_id ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      updateItem.mutate({ itemId: item.id, input: { category_id: e.target.value || undefined } })
                    }
                    aria-label={`Categoria de ${item.description}`}
                    className={`px-2 py-1 text-xs border rounded-md bg-[var(--background)] text-[var(--text-primary)] disabled:opacity-60 ${
                      !item.category_id && editable
                        ? "border-[var(--warning)] ring-1 ring-[var(--warning)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <option value="">Sem categoria</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--text-primary)] whitespace-nowrap">
                  {formatBRL(Number(item.amount))}
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={item.is_ignored}
                    disabled={!editable}
                    onChange={(e) =>
                      updateItem.mutate({ itemId: item.id, input: { is_ignored: e.target.checked } })
                    }
                    aria-label={`Ignorar ${item.description}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 p-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-mono font-semibold text-[var(--text-primary)]">{activeItems.length}</span> itens ·{" "}
            <span className="font-mono font-semibold text-[var(--text-primary)]">{formatBRL(activeTotal)}</span>
            {invoice.items.length !== activeItems.length && (
              <span className="text-xs text-[var(--text-muted)]"> ({invoice.items.length - activeItems.length} ignorados)</span>
            )}
          </p>
          <button
            onClick={onConfirm}
            disabled={confirming || activeItems.length === 0}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {confirming ? "Confirmando…" : "Confirmar fatura"}
          </button>
        </div>
      )}
    </div>
  );
}
