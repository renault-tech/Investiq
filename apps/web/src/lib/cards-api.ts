import { apiClient } from "./api-client";
import { coerceNumbers, coerceNumbersInList } from "./coerce";

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

export interface CategoryBreakdownSlice {
  category_id: string | null;
  category: string;
  amount: number;
  /** null = sem histórico com que comparar (a UI mostra "—", não 0%). */
  delta_pct: number | null;
}

export interface InvoiceTrendPoint {
  reference_month: string;
  total_amount: number;
}

export interface InvoiceFinding {
  kind: "duplicate" | "category_spike" | "uncategorized";
  title: string;
  description: string;
  amount: number | null;
}

export interface InvoiceAnalytics {
  invoice_id: string;
  category_breakdown: CategoryBreakdownSlice[];
  trend: InvoiceTrendPoint[];
  avg_amount: number;
  top_items: InvoiceItem[];
  findings: InvoiceFinding[];
}

const BREAKDOWN_NUMERIC = ["amount", "delta_pct"] as const;
const TREND_NUMERIC = ["total_amount"] as const;
const FINDING_NUMERIC = ["amount"] as const;
const TOP_ITEM_NUMERIC = ["amount"] as const;

export async function getInvoiceAnalytics(invoiceId: string): Promise<InvoiceAnalytics> {
  const res = await apiClient.get<InvoiceAnalytics>(`/cards/invoices/${invoiceId}/analytics`);
  // Decimal do Pydantic chega como string: sem coagir aqui, delta_pct.toFixed()
  // derruba o painel em runtime (ver lib/coerce.ts).
  const data = coerceNumbers(res.data, ["avg_amount"] as const);
  return {
    ...data,
    category_breakdown: coerceNumbersInList(data.category_breakdown ?? [], BREAKDOWN_NUMERIC),
    trend: coerceNumbersInList(data.trend ?? [], TREND_NUMERIC),
    findings: coerceNumbersInList(data.findings ?? [], FINDING_NUMERIC),
    top_items: coerceNumbersInList(data.top_items ?? [], TOP_ITEM_NUMERIC),
  };
}
