import { apiClient } from "./api-client";

export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  category_color: string | null;
  /** null = orçamento consolidado, valendo para todas as carteiras somadas. */
  bank_account_id: string | null;
  amount: number;
  period: string;
  spent: number;
  pct_used: number;
}

export async function listBudgets(accountId?: string | null): Promise<Budget[]> {
  const res = await apiClient.get<Budget[]>("/finance/budgets", {
    params: { account_id: accountId || undefined },
  });
  return res.data;
}

export async function upsertBudget(
  categoryId: string,
  amount: number,
  accountId?: string | null
): Promise<Budget> {
  const res = await apiClient.put<Budget>("/finance/budgets", {
    category_id: categoryId,
    amount,
    bank_account_id: accountId || null,
  });
  return res.data;
}

export async function deleteBudget(categoryId: string, accountId?: string | null): Promise<void> {
  await apiClient.delete(`/finance/budgets/${categoryId}`, {
    params: { account_id: accountId || undefined },
  });
}
