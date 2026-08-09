import { apiClient } from "./api-client";

export type ImportFileType = "ofx" | "csv";
export type ImportBatchStatus = "pending" | "confirmed" | "discarded";

export interface ImportRow {
  id: string;
  transaction_date: string;
  amount: number;
  transaction_type: "income" | "expense";
  description: string;
  external_id: string | null;
  category_id: string | null;
  category_name: string | null;
  /** Já existe um lançamento parecido — vem desmarcada por padrão, mas o
   * usuário pode forçar a seleção se decidir que não é duplicata mesmo. */
  is_duplicate: boolean;
  duplicate_transaction_id: string | null;
  is_selected: boolean;
}

export interface ImportBatch {
  id: string;
  bank_account_id: string | null;
  file_name: string;
  file_type: ImportFileType;
  status: ImportBatchStatus;
  rows: ImportRow[];
}

export interface ImportRowUpdateInput {
  category_id?: string | null;
  is_selected?: boolean;
}

export async function uploadStatement(file: File, bankAccountId?: string): Promise<ImportBatch> {
  const form = new FormData();
  form.append("file", file);
  if (bankAccountId) form.append("bank_account_id", bankAccountId);
  const res = await apiClient.post<ImportBatch>("/finance/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60_000,
  });
  return res.data;
}

export async function getImportBatch(batchId: string): Promise<ImportBatch> {
  const res = await apiClient.get<ImportBatch>(`/finance/import/${batchId}`);
  return res.data;
}

export async function updateImportRow(rowId: string, input: ImportRowUpdateInput): Promise<ImportRow> {
  const res = await apiClient.patch<ImportRow>(`/finance/import/rows/${rowId}`, input);
  return res.data;
}

export async function confirmImportBatch(
  batchId: string
): Promise<{ created: number; skipped: number }> {
  const res = await apiClient.post(`/finance/import/${batchId}/confirm`);
  return res.data;
}

export async function discardImportBatch(batchId: string): Promise<void> {
  await apiClient.delete(`/finance/import/${batchId}`);
}

/** Sugere categoria via IA só para as linhas sem categoria — gasta o crédito
 * do próprio usuário, por isso é uma ação explícita, nunca automática. */
export async function categorizeImportBatchWithAI(batchId: string): Promise<ImportBatch> {
  const res = await apiClient.post<ImportBatch>(`/finance/import/${batchId}/categorize-ai`, null, {
    timeout: 60_000,
  });
  return res.data;
}
