"use client";

import { AlertTriangle } from "lucide-react";
import { ImportBatch } from "@/lib/import-api";
import { FinanceCategory } from "@/lib/finance-api";
import { useUpdateImportRow } from "@/hooks/useImport";
import { formatBRLExact } from "@/components/charts/chartTheme";

interface Props {
  batch: ImportBatch;
  categories: FinanceCategory[];
}

export function ImportReviewTable({ batch, categories }: Props) {
  const updateRow = useUpdateImportRow(batch.id);
  const editable = batch.status === "pending";

  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-[var(--border)] rounded-lg">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[var(--surface)]">
          <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
            <th className="px-3 py-2 font-medium text-center">Incluir</th>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">Descrição</th>
            <th className="px-3 py-2 font-medium">Categoria</th>
            <th className="px-3 py-2 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {batch.rows.map((row) => {
            const categoryOptions = categories.filter(
              (c) => c.category_type === row.transaction_type && c.is_active
            );
            return (
              <tr
                key={row.id}
                className={`border-b border-[var(--border)] ${!row.is_selected ? "opacity-50" : ""}`}
              >
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={row.is_selected}
                    disabled={!editable}
                    onChange={(e) =>
                      updateRow.mutate({ rowId: row.id, input: { is_selected: e.target.checked } })
                    }
                    aria-label={`Incluir ${row.description}`}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                  {new Date(row.transaction_date).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-3 py-2 text-[var(--text-primary)] max-w-64 truncate" title={row.description}>
                  <span className="flex items-center gap-1.5">
                    {row.description}
                    {row.is_duplicate && (
                      <span
                        title="Já existe um lançamento parecido — confira antes de incluir"
                        className="inline-flex items-center gap-1 text-[10px] text-[var(--warning)] border border-[var(--warning)] rounded px-1 shrink-0"
                      >
                        <AlertTriangle size={10} /> possível duplicata
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={row.category_id ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      updateRow.mutate({
                        rowId: row.id,
                        input: { category_id: e.target.value || null },
                      })
                    }
                    aria-label={`Categoria de ${row.description}`}
                    className="px-2 py-1 text-xs border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--text-primary)] disabled:opacity-60"
                  >
                    <option value="">Sem categoria</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono whitespace-nowrap ${
                    row.transaction_type === "expense" ? "text-[var(--danger)]" : "text-[var(--accent)]"
                  }`}
                >
                  {row.transaction_type === "expense" ? "−" : "+"}
                  {formatBRLExact(Number(row.amount))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
