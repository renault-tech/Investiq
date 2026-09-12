import { apiClient } from "./api-client";

export type QuickReportType = "monthly-summary" | "consolidated-statement" | "benchmark-performance" | "tax-report";

export interface GeneratedReport {
  id: string;
  report_type: "monthly_summary" | "consolidated_statement" | "benchmark_performance" | "tax_report";
  format: "pdf" | "xlsx" | "csv";
  params: Record<string, unknown>;
  file_name: string;
  file_size: number;
  created_at: string;
}

export const REPORT_TYPE_LABELS: Record<GeneratedReport["report_type"], string> = {
  monthly_summary: "Resumo mensal",
  consolidated_statement: "Extrato consolidado",
  benchmark_performance: "Rentabilidade vs benchmarks",
  tax_report: "Relatório fiscal",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

/** Gera um dos 4 relatórios rápidos e já dispara o download — o backend
 * persiste uma cópia em generated_reports como efeito colateral, é o que
 * alimenta a lista "Relatórios gerados" logo abaixo. Nome do arquivo vem do
 * chamador (não lido do header Content-Disposition — mesmo padrão já usado
 * em report-export.ts, evita depender de Access-Control-Expose-Headers). */
export async function quickGenerateReport(
  type: QuickReportType,
  params: Record<string, string | number | undefined>,
  fileName: string
): Promise<void> {
  const res = await apiClient.get(`/reports/quick/${type}`, {
    params,
    responseType: "blob",
  });
  downloadBlob(res.data as Blob, fileName);
}

export async function listGeneratedReports(): Promise<GeneratedReport[]> {
  const res = await apiClient.get<GeneratedReport[]>("/reports/generated");
  return res.data;
}

export async function downloadGeneratedReport(report: GeneratedReport): Promise<void> {
  const res = await apiClient.get(`/reports/generated/${report.id}/download`, { responseType: "blob" });
  downloadBlob(res.data as Blob, report.file_name);
}

export async function deleteGeneratedReport(id: string): Promise<void> {
  await apiClient.delete(`/reports/generated/${id}`);
}
