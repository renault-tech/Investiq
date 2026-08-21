/** Montagem e download do relatório mensal.
 *
 * Um único lugar constrói a query de `/reports/monthly`, porque agora três
 * telas exportam (Relatórios, Finanças e Investimentos) e uma divergência
 * entre elas geraria documentos diferentes para a mesma escolha.
 */
import { apiClient } from "@/lib/api-client";

export type ReportFormat = "pdf" | "xlsx";

export interface ReportOptions {
  month: string;
  format: ReportFormat;
  accountIds: string[];
  portfolioIds: string[];
  includeFinance: boolean;
  includeInvestments: boolean;
  includeCharts: boolean;
}

export const DEFAULT_REPORT_OPTIONS: Omit<ReportOptions, "month"> = {
  format: "pdf",
  accountIds: [],
  portfolioIds: [],
  includeFinance: true,
  includeInvestments: true,
  includeCharts: true,
};

/** Query da API. Listas vazias são omitidas: no backend "ausente" significa
 * "todas, consolidado", que não é a mesma coisa que uma lista vazia. */
export function reportQueryParams(options: ReportOptions): Record<string, string> {
  return {
    month: options.month,
    format: options.format,
    ...(options.accountIds.length ? { account_ids: options.accountIds.join(",") } : {}),
    ...(options.portfolioIds.length ? { portfolio_ids: options.portfolioIds.join(",") } : {}),
    include_finance: String(options.includeFinance),
    include_investments: String(options.includeInvestments),
    include_charts: String(options.includeCharts),
  };
}

/** Nome do arquivo, descrevendo o que ele contém — "relatorio-2026-08.pdf"
 * não distingue um relatório completo de um só de finanças, e quem baixa os
 * dois no mesmo dia acaba com "(1)" no fim de um deles. */
export function reportFileName(options: ReportOptions): string {
  const scope = !options.includeInvestments
    ? "financas"
    : !options.includeFinance
    ? "investimentos"
    : "completo";
  return `relatorio-${scope}-${options.month}.${options.format}`;
}

export function isValidSelection(options: ReportOptions): boolean {
  return options.includeFinance || options.includeInvestments;
}

export async function downloadReport(options: ReportOptions): Promise<void> {
  const res = await apiClient.get("/reports/monthly", {
    params: reportQueryParams(options),
    responseType: "blob",
  });
  const blobUrl = window.URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = reportFileName(options);
  link.click();
  window.URL.revokeObjectURL(blobUrl);
}

/** Últimos `count` meses, mais recente primeiro — "2026-08". */
export function recentMonths(count = 12, from = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/** "Agosto de 2026" — só a inicial em maiúscula.
 *
 * A classe `capitalize` do CSS capitaliza cada palavra e produzia "Agosto De
 * 2026"; em português a preposição fica minúscula. */
export function monthLabel(month: string): string {
  const label = new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
