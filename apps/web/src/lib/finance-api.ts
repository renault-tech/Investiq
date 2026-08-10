import { apiClient } from "./api-client";
import { coerceNumbers, coerceNumbersInList } from "./coerce";

export interface FinanceCategory {
  id: string;
  name: string;
  category_type: "income" | "expense";
  color: string | null;
  icon: string | null;
  is_active: boolean;
}

export interface FinanceTransaction {
  id: string; // UUID ou "{uuid}:{date}" para ocorrência virtual
  transaction_type: "income" | "expense" | "transfer";
  amount: number;
  currency: string;
  description: string | null;
  notes: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  bank_account_id: string | null;
  bank_account_name: string | null;
  to_bank_account_id: string | null;
  to_bank_account_name: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurrence_rule: string | null;
  installment_no: number | null;
  installment_total: number | null;
  source: TransactionSource;
  is_virtual: boolean;
  tags: string[];
}

/** De onde o lançamento veio. "manual" é digitado à mão e aparece marcado
 * como tal na tabela — importado e vindo de fatura têm outra procedência. */
export type TransactionSource =
  | "manual"
  | "import_ofx"
  | "import_csv"
  | "card_invoice"
  | "installment";

export interface TransactionList {
  items: FinanceTransaction[];
  total: number;
  page: number;
  per_page: number;
}

export interface TransactionFilters {
  date_from?: string;
  date_to?: string;
  category_id?: string;
  transaction_type?: "income" | "expense" | "transfer";
  search?: string;
  account_id?: string;
  holder?: string;
  page?: number;
  per_page?: number;
}

export interface CategorySummary {
  category_id: string | null;
  category_name: string;
  category_color: string | null;
  value: number;
  pct: number;
}

export interface MonthlyFlowPoint {
  month: string;
  income: number;
  expense: number;
}

export interface FinanceSummary {
  month: string;
  income: number;
  expense: number;
  net: number;
  income_prev_pct: number | null;
  expense_prev_pct: number | null;
  by_category: CategorySummary[];
  monthly_series: MonthlyFlowPoint[];
}

export interface CreateTransactionInput {
  transaction_type: "income" | "expense" | "transfer";
  amount: number;
  description?: string;
  notes?: string;
  category_id?: string;
  bank_account_id?: string;
  to_bank_account_id?: string;
  transaction_date: string;
  recurrence_rule?: string;
  /** >1 materializa N parcelas mensais; `amount` é o total da compra. */
  installments?: number;
  tags?: string[];
}

export async function listCategories(): Promise<FinanceCategory[]> {
  const res = await apiClient.get<FinanceCategory[]>("/finance/categories");
  return res.data;
}

export async function createCategory(input: {
  name: string;
  category_type: "income" | "expense";
  color?: string;
  icon?: string;
}): Promise<FinanceCategory> {
  const res = await apiClient.post<FinanceCategory>("/finance/categories", input);
  return res.data;
}

export async function updateCategory(
  id: string,
  input: Partial<Pick<FinanceCategory, "name" | "color" | "icon" | "is_active">>
): Promise<FinanceCategory> {
  const res = await apiClient.patch<FinanceCategory>(`/finance/categories/${id}`, input);
  return res.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/finance/categories/${id}`);
}

export async function listTransactions(filters: TransactionFilters): Promise<TransactionList> {
  const res = await apiClient.get<TransactionList>("/finance/transactions", { params: filters });
  return { ...res.data, items: coerceNumbersInList(res.data.items ?? [], ["amount"] as const) };
}

export async function createTransaction(input: CreateTransactionInput): Promise<FinanceTransaction> {
  const res = await apiClient.post<FinanceTransaction>("/finance/transactions", input);
  return res.data;
}

export async function updateTransaction(
  id: string,
  input: Partial<CreateTransactionInput>
): Promise<FinanceTransaction> {
  const res = await apiClient.patch<FinanceTransaction>(`/finance/transactions/${id}`, input);
  return res.data;
}

/** `scope` só importa para parcelamentos: apagar uma parcela, esta e as
 * seguintes, ou a série inteira. */
export async function deleteTransaction(
  id: string,
  scope: "one" | "future" | "all" = "one"
): Promise<void> {
  await apiClient.delete(`/finance/transactions/${id}`, { params: { scope } });
}

export async function getFinanceSummary(month: string): Promise<FinanceSummary> {
  const res = await apiClient.get<FinanceSummary>("/finance/summary", { params: { month } });
  const data = coerceNumbers(res.data, ["income", "expense", "net", "income_prev_pct", "expense_prev_pct"] as const);
  return {
    ...data,
    by_category: coerceNumbersInList(data.by_category ?? [], ["value", "pct"] as const),
    monthly_series: coerceNumbersInList(data.monthly_series ?? [], ["income", "expense"] as const),
  };
}
