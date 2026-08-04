import { apiClient } from "./api-client";

export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  category_color: string | null;
  amount: number;
  period: string;
  spent: number;
  pct_used: number;
}

export async function listBudgets(): Promise<Budget[]> {
  const res = await apiClient.get<Budget[]>("/finance/budgets");
  return res.data;
}

export async function upsertBudget(categoryId: string, amount: number): Promise<Budget> {
  const res = await apiClient.put<Budget>("/finance/budgets", { category_id: categoryId, amount });
  return res.data;
}

export async function deleteBudget(categoryId: string): Promise<void> {
  await apiClient.delete(`/finance/budgets/${categoryId}`);
}
