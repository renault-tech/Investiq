import { apiClient } from "@/lib/api-client";

export interface FinanceCategory {
  id: string;
  name: string;
  category_type: "income" | "expense";
  color: string | null;
  icon: string | null;
  is_active: boolean;
}

export interface FinanceTransaction {
  id: string;
  transaction_type: "income" | "expense" | "transfer";
  amount: string;
  description: string;
  notes: string | null;
  transaction_date: string;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  created_at: string;
}

export interface MonthlySummary {
  year: number;
  month: number;
  total_income: string;
  total_expense: string;
  balance: string;
  savings_rate: string | null;
}

export interface MonthlyBar {
  year: number;
  month: number;
  income: string;
  expense: string;
}

export interface FinanceSummary {
  current: MonthlySummary;
  last_6_months: MonthlyBar[];
}

export interface TransactionCreateInput {
  transaction_type: "income" | "expense" | "transfer";
  amount: number;
  description: string;
  category_id?: string | null;
  transaction_date: string;
  notes?: string | null;
}

export const getFinanceSummary = (year: number, month: number): Promise<FinanceSummary> =>
  apiClient.get("/finance/summary", { params: { year, month } }).then((r) => r.data);

export const listTransactions = (year: number, month: number): Promise<FinanceTransaction[]> =>
  apiClient.get("/finance/transactions", { params: { year, month } }).then((r) => r.data);

export const createTransaction = (input: TransactionCreateInput): Promise<FinanceTransaction> =>
  apiClient.post("/finance/transactions", input).then((r) => r.data);

export const deleteTransaction = (id: string): Promise<void> =>
  apiClient.delete(`/finance/transactions/${id}`).then(() => undefined);

export const listCategories = (): Promise<FinanceCategory[]> =>
  apiClient.get("/finance/categories").then((r) => r.data);
