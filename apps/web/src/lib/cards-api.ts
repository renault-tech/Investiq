import { apiClient } from "./api-client";

export interface CreditCard {
  id: string;
  name: string;
  brand: "visa" | "mastercard" | "elo" | "amex" | "other" | null;
  last4: string | null;
  credit_limit: number | null;
  closing_day: number | null;
  due_day: number | null;
  is_active: boolean;
}

export type InvoiceStatus = "processing" | "review" | "confirmed" | "failed";

export interface CardInvoice {
  id: string;
  card_id: string;
  reference_month: string;
  due_date: string | null;
  status: InvoiceStatus;
  total_amount: number | null;
  file_name: string | null;
  error_message: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  purchase_date: string | null;
  installment_no: number | null;
  installment_total: number | null;
  suggested_category_id: string | null;
  category_id: string | null;
  financial_transaction_id: string | null;
  is_ignored: boolean;
}

export interface InvoiceDetail extends CardInvoice {
  items: InvoiceItem[];
}

export interface CardInput {
  name: string;
  brand?: CreditCard["brand"];
  last4?: string;
  credit_limit?: number;
  closing_day?: number;
  due_day?: number;
}

export async function listCards(): Promise<CreditCard[]> {
  const res = await apiClient.get<CreditCard[]>("/cards");
  return res.data;
}

export async function createCard(input: CardInput): Promise<CreditCard> {
  const res = await apiClient.post<CreditCard>("/cards", input);
  return res.data;
}

export async function updateCard(id: string, input: Partial<CardInput>): Promise<CreditCard> {
  const res = await apiClient.patch<CreditCard>(`/cards/${id}`, input);
  return res.data;
}

export async function deleteCard(id: string): Promise<void> {
  await apiClient.delete(`/cards/${id}`);
}

export async function listInvoices(cardId: string): Promise<CardInvoice[]> {
  const res = await apiClient.get<CardInvoice[]>(`/cards/${cardId}/invoices`);
  return res.data;
}

export async function getInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const res = await apiClient.get<InvoiceDetail>(`/cards/invoices/${invoiceId}`);
  return res.data;
}

export async function uploadInvoice(
  cardId: string,
  referenceMonth: string, // YYYY-MM-DD
  file: File
): Promise<CardInvoice> {
  const form = new FormData();
  form.append("reference_month", referenceMonth);
  form.append("file", file);
  // Sem header de Content-Type explícito: o axios repassa o FormData intacto
  // e o próprio browser gera "multipart/form-data; boundary=...". Fixar o
  // header aqui (sem boundary) quebra o parse multipart no servidor — a
  // requisição chega sem boundary, o FastAPI não consegue ler `file`/
  // `reference_month` e devolve 422.
  const res = await apiClient.post<CardInvoice>(`/cards/${cardId}/invoices`, form, {
    timeout: 180_000, // extração via LLM pode demorar
  });
  return res.data;
}

export async function updateInvoiceItem(
  invoiceId: string,
  itemId: string,
  input: Partial<Pick<InvoiceItem, "description" | "amount" | "category_id" | "is_ignored">>
): Promise<InvoiceItem> {
  const res = await apiClient.patch<InvoiceItem>(
    `/cards/invoices/${invoiceId}/items/${itemId}`,
    input
  );
  return res.data;
}

export async function confirmInvoice(invoiceId: string): Promise<CardInvoice> {
  const res = await apiClient.post<CardInvoice>(`/cards/invoices/${invoiceId}/confirm`);
  return res.data;
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  await apiClient.delete(`/cards/invoices/${invoiceId}`);
}
