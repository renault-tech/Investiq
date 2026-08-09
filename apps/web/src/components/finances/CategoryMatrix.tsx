"use client";

import { CategoryMatrixRow } from "@/lib/analytics-api";
import { formatBRLCompact } from "@/components/charts/chartTheme";

function formatMonth(month: string): string {
  const [year, mon] = month.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(mon) - 1]}/${year.slice(2)}`;
}

interface Props {
  months: string[];
  rows: CategoryMatrixRow[];
}

/** Intensidade proporcional ao maior valor da matriz inteira — assim a cor de
 * uma célula é comparável com a de qualquer outra, não só dentro da própria linha. */
export function CategoryMatrix({ months, rows: rawRows }: Props) {
  // Decimal chega como string no JSON — converte antes de comparar/formatar.
  const rows = rawRows.map((r) => ({ ...r, values: r.values.map(Number) }));
  const max = Math.max(1, ...rows.flatMap((r) => r.values));

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] py-6 text-center">Sem despesas no período.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="text-left font-medium text-[var(--text-muted)] px-1 pb-1">Categoria</th>
            {months.map((m) => (
              <th key={m} className="font-medium text-[var(--text-muted)] px-1 pb-1 whitespace-nowrap">
                {formatMonth(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category_id ?? "none"}>
              <td className="text-[var(--text-primary)] px-1 whitespace-nowrap max-w-32 truncate" title={row.category_name}>
                {row.category_name}
              </td>
              {row.values.map((value, i) => {
                const intensity = value / max;
                return (
                  <td key={months[i]} className="p-0">
                    <div
                      className="rounded-md text-center font-mono py-1.5 px-1 min-w-16"
                      style={{
                        backgroundColor: value > 0 ? `rgba(37, 99, 235, ${0.08 + intensity * 0.55})` : "transparent",
                        color: intensity > 0.5 ? "#fff" : "var(--text-secondary)",
                      }}
                      title={`${row.category_name} · ${formatMonth(months[i])}`}
                    >
                      {value > 0 ? formatBRLCompact(value) : "—"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
